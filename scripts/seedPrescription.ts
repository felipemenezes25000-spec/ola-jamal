/**
 * Seed one prescription for verification testing.
 * Env: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou do backend: Supabase__Url e Supabase__ServiceKey).
 * Run: npm run seed (desde scripts/)
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, createHash } from "node:crypto";
import { resolve } from "node:path";

// Env do scripts/.env ou do backend (Supabase__Url, Supabase__ServiceKey)
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../backend-dotnet/src/RenoveJa.Api/.env") });

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env["Supabase__Url"] ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env["Supabase__ServiceKey"] ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 10);
  return out;
}

function randomToken(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Minimal valid PDF (single page, empty) for testing
const MINIMAL_PDF_BASE64 =
  "JVBERi0xLjQKJcOkw7zDtsOcCjIgMCBvYmoKPDwKL0xlbmd0aCA0NAovRmlsdGVyIC9GbGF0ZURlY29kZQo+PgpzdHJlYW0KJeJyzUvJTFGxVTI0MtJRskpMyklVslJQKMrPTVWyUlAoyM9TslIqys9NVbJSMAQAOgkEtwplbmRzdHJlYW0KZW5kb2JqCjQgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCA1IDAgUgovTWVkaWFCb3ggWyAwIDAgNjEyIDc5MiBdCi9Db250ZW50cyAyIDAgUgo+PgplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvUGFnZXMKL0tpZHMgWyA0IDAgUiBdCi9Db3VudCAxCi9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0KPj4KZW5kb2JqCjYgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDUgMCBSCj4+CmVuZG9iago3IDAgb2JqCjw8Ci9UeXBlIC9Gb250Ci9TdWJ0eXBlIC9UeXBlMQovQmFzZUZvbnQgL0hlbHZldGljYQo+PgplbmRvYmoKOCAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EtQm9sZAo+PgplbmRvYmoKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgNiAwIFIKPj4KZW5kb2JqCjkgMCBvYmoKPDwKL1Byb2R1Y2VyIChSZW5vdmVKYSBTZWVkKQo+PgplbmRvYmoKMTAgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhLU9ibGlxdWUKPj4KZW5kb2JqCnhyZWYKMCAxMQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyMjQgMDAwMDAgbiAKMDAwMDAwMDM0NyAwMDAwMCBuIAowMDAwMDAwNDA0IDAwMDAwIG4gCjAwMDAwMDA0NjEgMDAwMDAgbiAKMDAwMDAwMDU0NCAwMDAwMCBuIAowMDAwMDAwNjAxIDAwMDAwIG4gCjAwMDAwMDA2NTggMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSAxMQovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNzM1CiUlRU9G";
const MINIMAL_PDF_BUFFER = Buffer.from(MINIMAL_PDF_BASE64, "base64");

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  const id = randomUUID();
  const code = randomDigits(6);
  const qrToken = randomToken(32);

  const verifyCodeHash = sha256Hex(code);
  const qrTokenHash = sha256Hex(qrToken);
  const now = new Date();
  const qrTokenExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

  const pdfFileName = `${id}.pdf`;
  const pdfStoragePath = pdfFileName;

  const { error: uploadError } = await supabase.storage
    .from("prescriptions")
    .upload(pdfStoragePath, MINIMAL_PDF_BUFFER, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("Storage upload failed:", uploadError.message);
    console.error("Ensure bucket 'prescriptions' exists and is private.");
    process.exit(1);
  }

  const issuedDateStr = now.toISOString().slice(0, 10);
  const { error: insertError } = await supabase.from("prescriptions").insert({
    id,
    status: "active",
    issued_at: now.toISOString(),
    issued_date_str: issuedDateStr,
    patient_initials: "J.S.",
    prescriber_crm_uf: "DF",
    prescriber_crm_last4: "1234",
    verify_code_hash: verifyCodeHash,
    qr_token_hash: qrTokenHash,
    qr_token_expires_at: qrTokenExpiresAt.toISOString(),
    pdf_storage_path: pdfStoragePath,
  });

  if (insertError) {
    console.error("Insert failed:", insertError.message);
    process.exit(1);
  }

  const baseUrl = "https://renovejasaude.com.br";
  console.log("\n--- Prescription seeded ---\n");
  console.log("Verify URL:");
  console.log(`${baseUrl}/verify/${id}?v=${qrToken}\n`);
  console.log("Code:");
  console.log(`${code}\n`);
}

main();
