// RenoveJá+ Verify Edge Function — tabela receitas
// POST body: { id: string, code: string, v?: string }
// Usa SUPABASE_SERVICE_ROLE_KEY (nunca expor no frontend)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_LENGTH = 6;

interface VerifyPayload {
  id: string;
  code: string;
  v?: string;
}

interface ReceitaRow {
  id: string;
  codigo: string;
  token_hash: string | null;
  paciente_iniciais: string | null;
  crm_uf: string | null;
  emitida_em: string | null;
  pdf_url: string | null;
  status: string;
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

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? null;

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed" },
      405,
      corsHeaders(origin)
    );
  }

  let payload: VerifyPayload;
  try {
    payload = (await req.json()) as VerifyPayload;
  } catch {
    return jsonResponse(
      { error: "Invalid JSON body" },
      400,
      corsHeaders(origin)
    );
  }

  const { id, code, v } = payload;

  if (!id || typeof id !== "string" || !UUID_REGEX.test(id.trim())) {
    return jsonResponse(
      { status: "error", error: "invalid_id" },
      400,
      corsHeaders(origin)
    );
  }
  if (!code || typeof code !== "string" || code.trim().length !== CODE_LENGTH) {
    return jsonResponse(
      { status: "error", error: "invalid_code" },
      400,
      corsHeaders(origin)
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: row, error: fetchError } = await supabase
    .from("receitas")
    .select("id, codigo, token_hash, paciente_iniciais, crm_uf, emitida_em, pdf_url, status")
    .eq("id", id.trim())
    .single();

  if (fetchError || !row) {
    return jsonResponse(
      { status: "invalid", error: "not_found" },
      404,
      corsHeaders(origin)
    );
  }

  const r = row as ReceitaRow;

  if (r.status !== "active") {
    const err = r.status === "revoked" ? "revoked" : r.status === "expired" ? "expired" : "invalid";
    return jsonResponse(
      { status: "invalid", error: err },
      403,
      corsHeaders(origin)
    );
  }

  if (r.codigo.trim().toUpperCase() !== code.trim().toUpperCase()) {
    return jsonResponse(
      { status: "invalid", error: "invalid_code" },
      403,
      corsHeaders(origin)
    );
  }

  const emitidaIso = r.emitida_em ? new Date(r.emitida_em).toISOString() : undefined;

  return jsonResponse(
    {
      status: "valid",
      downloadUrl: r.pdf_url || undefined,
      meta: {
        paciente: r.paciente_iniciais ?? undefined,
        crm: r.crm_uf ?? undefined,
        emitida: emitidaIso,
        patientInitials: r.paciente_iniciais ?? undefined,
        crmMasked: r.crm_uf ?? undefined,
        issuedAt: emitidaIso,
      },
    },
    200,
    corsHeaders(origin)
  );
});
