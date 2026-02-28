// RenoveJá+ Verify v2 — prescriptions + prescription_verification_logs + signed URL
// POST body: { id: string, code: string, v?: string }
// Usa SUPABASE_SERVICE_ROLE_KEY (nunca expor no frontend)
// downloadUrl aponta para API própria (renovejasaude.com.br) para manter domínio na barra do navegador.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_BASE_URL = Deno.env.get("API_BASE_URL") ?? "https://renovejasaude.com.br";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_DIGITS_ONLY = /^[0-9]{6}$/;

interface VerifyPayload {
  id: string;
  code: string;
  v?: string;
}

interface PrescriptionRow {
  id: string;
  status: string;
  issued_at: string;
  issued_date_str: string | null;
  patient_initials: string | null;
  prescriber_crm_uf: string | null;
  prescriber_crm_last4: string | null;
  verify_code_hash: string | null;
  qr_token_hash: string | null;
  qr_token_expires_at: string | null;
  pdf_storage_path: string | null;
}

type LogOutcome =
  | "valid"
  | "invalid_code"
  | "invalid_token"
  | "revoked"
  | "expired"
  | "not_found"
  | "error";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin ?? "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Apikey",
  };
}

function jsonResponse(body: object, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function getClientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip")
  );
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? null;

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(origin));
  }

  let payload: VerifyPayload;
  try {
    payload = (await req.json()) as VerifyPayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, corsHeaders(origin));
  }

  const { id, code, v } = payload;
  const idTrim = typeof id === "string" ? id.trim() : "";
  const codeTrim = typeof code === "string" ? code.trim() : "";
  const vTrim = typeof v === "string" ? v.trim() : undefined;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") ?? null;

  const correlationId = req.headers.get("x-correlation-id") ?? null;

  const logAndReturn = async (
    prescriptionId: string | null,
    outcome: LogOutcome,
    status: number,
    body: object,
    details?: Record<string, unknown>
  ) => {
    if (prescriptionId) {
      await supabase.from("prescription_verification_logs").insert({
        prescription_id: prescriptionId,
        ip,
        user_agent: userAgent,
        outcome,
        correlation_id: correlationId,
        details: details ?? null,
      });
    }
    const responseHeaders = {
      ...corsHeaders(origin),
      ...(correlationId ? { "X-Correlation-Id": correlationId } : {}),
    };
    return jsonResponse(body, status, responseHeaders);
  };

  if (!idTrim || !UUID_REGEX.test(idTrim)) {
    return jsonResponse(
      { status: "invalid", error: "invalid_id" },
      400,
      corsHeaders(origin)
    );
  }
  if (!CODE_DIGITS_ONLY.test(codeTrim)) {
    return jsonResponse(
      { status: "invalid", error: "invalid_code_format" },
      400,
      corsHeaders(origin)
    );
  }

  const { data: row, error: fetchError } = await supabase
    .from("prescriptions")
    .select(
      "id, status, issued_at, issued_date_str, patient_initials, prescriber_crm_uf, prescriber_crm_last4, verify_code_hash, qr_token_hash, qr_token_expires_at, pdf_storage_path"
    )
    .eq("id", idTrim)
    .single();

  if (fetchError || !row) {
    return logAndReturn(null, "not_found", 404, { status: "invalid", error: "not_found" });
  }

  const r = row as PrescriptionRow;

  if (r.status !== "active") {
    const err: LogOutcome = r.status === "revoked" ? "revoked" : r.status === "expired" ? "expired" : "error";
    return logAndReturn(
      r.id,
      err,
      403,
      { status: "invalid", error: err },
      { hadStatus: r.status }
    );
  }

  if (!r.verify_code_hash) {
    return logAndReturn(r.id, "error", 403, { status: "invalid", error: "invalid_code" });
  }

  const codeHash = await sha256Hex(codeTrim);
  if (codeHash !== r.verify_code_hash) {
    return logAndReturn(
      r.id,
      "invalid_code",
      403,
      { status: "invalid", error: "invalid_code" },
      { vPresent: !!vTrim }
    );
  }

  if (r.qr_token_hash) {
    if (!vTrim) {
      return logAndReturn(
        r.id,
        "invalid_token",
        403,
        { status: "invalid", error: "invalid_token" },
        { vPresent: false }
      );
    }
    const vHash = await sha256Hex(vTrim);
    if (vHash !== r.qr_token_hash) {
      return logAndReturn(
        r.id,
        "invalid_token",
        403,
        { status: "invalid", error: "invalid_token" },
        { vPresent: true }
      );
    }
    if (r.qr_token_expires_at) {
      const expiresAt = new Date(r.qr_token_expires_at).getTime();
      if (Date.now() > expiresAt) {
        return logAndReturn(
          r.id,
          "expired",
          403,
          { status: "invalid", error: "expired" },
          { vPresent: true }
        );
      }
    }
  }

  // URL de 2ª via: gera signed URL diretamente do Supabase Storage (funciona mesmo sem API_BASE_URL acessível)
  let downloadUrl: string | undefined;

  if (r.pdf_storage_path) {
    try {
      const { data: signedUrlData, error: signedUrlError } = await supabase
        .storage
        .from("prescriptions")
        .createSignedUrl(r.pdf_storage_path, 3600); // 1 hora de validade

      if (signedUrlData?.signedUrl && !signedUrlError) {
        downloadUrl = signedUrlData.signedUrl;
      }
    } catch {
      // Fallback: tentar via API backend
    }
  }

  // Fallback: URL via API backend (requer API_BASE_URL acessível)
  if (!downloadUrl) {
    const base = API_BASE_URL.replace(/\/$/, "");
    downloadUrl = `${base}/api/verify/${r.id}/document?code=${encodeURIComponent(codeTrim)}`;
  }

  const crmMasked =
    r.prescriber_crm_uf && r.prescriber_crm_last4
      ? `${r.prescriber_crm_uf} • ****${r.prescriber_crm_last4}`
      : undefined;

  return logAndReturn(
    r.id,
    "valid",
    200,
    {
      status: "valid",
      downloadUrl: downloadUrl ?? undefined,
      meta: {
        issuedAt: r.issued_at,
        issuedDate: r.issued_date_str ?? undefined,
        patientInitials: r.patient_initials ?? undefined,
        crmMasked: crmMasked ?? undefined,
        prescriberCrmUf: r.prescriber_crm_uf ?? undefined,
        prescriberCrmLast4: r.prescriber_crm_last4 ?? undefined,
      },
    },
    { vPresent: !!vTrim }
  );
});
