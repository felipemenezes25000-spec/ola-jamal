# Conformidade jurídica — Documentos clínicos digitais

**Referências:** ICP-Brasil (ITI), regras sanitárias, conselhos profissionais, jurisprudência e boas práticas de prova.

---

## 1. Assinatura digital ICP-Brasil (PAdES/ITI)

| Requisito | Status | Implementação |
|-----------|--------|---------------|
| PAdES (ISO/ETSI) | ✅ | `DigitalCertificateService.SignPdfWithBouncyCastle` — PKCS#7/CMS, SHA256 |
| OIDs ITI nos atributos | ✅ | `ItiHealthOidsSignatureContainer` — prescrição/exame, CRM, UF |
| DocMDP (P=2) | ✅ | Evita "Assinatura Indeterminada" no validar.iti.gov.br |
| Cadeia completa + TSA | ✅ | OCSP + CRL + timestamp TSA quando disponível |
| Aceito pelo validar.iti.gov.br | ✅ | Configuração em `docs/RENDER_CONFIG_ITI.md` |

---

## 2. Trilha de auditoria imutável

### 2.1 O que já existe

| Dado | Onde | Observação |
|------|------|------------|
| Quem gerou | `audit_logs.user_id`, `user_email`, `user_role` | Via `AuditMiddleware` e `AuditService.LogModificationAsync` |
| Quem assinou | `requests.doctor_id`, `signed_at`; `audit_logs` action "Sign" em `MedicalDocument` | `SignedRequestClinicalSyncService` |
| Quando | `audit_logs.event_timestamp`, `created_at`; `prescriptions.issued_at` | |
| IP / device | `audit_logs.ip_address`, `user_agent`; `prescription_verification_logs.ip`, `user_agent` | Verificação pública registra IP/UA |
| Hash do código de verificação | `prescriptions.verify_code_hash` (SHA256 do código 6 dígitos) | Não é hash do PDF |
| Hash de assinatura | `medical_documents.signature_hash` | Baseado em `signedDocumentUrl + signatureId`, não no conteúdo do PDF |
| old_values / new_values | `audit_logs.old_values`, `new_values` (JSONB) | Para auditoria de edições no prontuário |
| correlation_id | `audit_logs`, `prescription_verification_logs` | Rastreamento de requisições |

### 2.2 Lacunas recomendadas

| Lacuna | Status | Implementação |
|--------|--------|---------------|
| **Hash do PDF (conteúdo)** | ✅ | `pdf_hash` (SHA256) em `prescriptions` — migration `20260306130000_add_pdf_hash_to_prescriptions.sql`; `DigitalCertificateService` calcula e retorna; `PrescriptionVerifyRecord` persiste |
| **Imutabilidade dos logs** | ⚠️ | `audit_logs` e `prescription_verification_logs` não têm trigger anti-UPDATE/DELETE. Considerar política de append-only. |
| **Device fingerprint** | ⚠️ | Opcional: em cenários de alto risco, registrar fingerprint do dispositivo em `metadata` do audit. |

---

## 3. Verificação pública (QR + página)

| Requisito | Status | Implementação |
|-----------|--------|---------------|
| QR Code no PDF | ✅ | URL codificada: `/verify/<id>?v=<token>` |
| Página de verificação | ✅ | `frontend-web` rota `/verify/:id`; Edge Function `verify` (Supabase) |
| Código de 6 dígitos | ✅ | `verify_code_hash` (SHA256) em `prescriptions` |
| Log de tentativas | ✅ | `prescription_verification_logs` — outcome, IP, user_agent |
| Download 2ª via | ✅ | Signed URL do Storage ou endpoint `/api/verify/{id}/document?code=xxx` |
| Integração ITI | ✅ | `GET /api/verify/{id}?type=prescricao&_format=application/validador-iti+json&_secretCode=CODIGO` |

---

## 4. Política anti-fraude

### 4.1 Validação de identidade do paciente

| Nível de risco | O que existe | Recomendação |
|----------------|--------------|--------------|
| Receita simples | CPF em `users`; triagem por IA | Documentar fluxo de verificação de CPF (ex.: validação em cadastro). |
| Receita controlada | Mesmo fluxo | **Reforçar:** validação de CPF obrigatória antes de aprovar controlados; possível 2FA ou confirmação de identidade. |
| Receita azul | Ainda não liberada | Definir requisitos antes de lançar. |

### 4.2 Bloqueios para receitas indevidas

| Controle | Status | Observação |
|----------|--------|------------|
| Triagem por IA | ✅ | `OpenAiReadingService` — `signs_of_tampering`, `prescription_type_detected`, `has_doubts` |
| Tipo de receita obrigatório | ✅ | `prescriptionType` obrigatório (simples/controlado) |
| Validação de certificado | ✅ | Certificado ICP-Brasil obrigatório para assinar |
| Bloqueio por medicamento controlado | ⚠️ | Não há lista de medicamentos controlados (Portaria 344) para validação automática |

---

## 5. Atenção especial: controlados (Portaria 344/98)

### 5.1 Contexto regulatório

- **Portaria 344/98** e normativas correlatas (RDC 66/2016, etc.) regulam medicamentos sujeitos a controle especial.
- Regras de dispensação em farmácia podem exigir:
  - Receita em 2 vias (1ª e 2ª via)
  - Validade específica (ex.: 30 dias para alguns controlados)
  - Retenção da 1ª via na farmácia
  - Notificação em sistemas de controle (SNGPC)

### 5.2 O que o sistema já faz

- `prescription_type = 'controlado'` com layout e avisos específicos no PDF
- Orientação ao paciente sobre retorno regular ao médico
- Preço diferenciado e fluxo de aprovação

### 5.3 Recomendação

> **Revisão jurídica específica** para o fluxo de receitas controladas. É o ponto com maior risco regulatório e onde mais surgem questionamentos. Sugestões:
>
> 1. Consultar advogado especializado em direito sanitário/farmacêutico.
> 2. Validar conformidade com RDC 44/2009 (receita em meio eletrônico) e normativas vigentes.
> 3. Avaliar necessidade de integração com SNGPC ou sistemas de notificação.
> 4. Documentar política de retenção e arquivamento de receitas controladas.

---

## 6. Resumo executivo

| Área | Situação | Ação sugerida |
|------|----------|---------------|
| Assinatura ICP-Brasil | ✅ Conforme | Manter e monitorar validadores ITI/Adobe |
| Trilha de auditoria | ✅ Parcial | Adicionar `pdf_hash`; avaliar imutabilidade dos logs |
| Verificação pública | ✅ Conforme | Manter |
| Anti-fraude / identidade | ⚠️ Parcial | Documentar fluxo de validação de CPF; reforçar para controlados |
| Controlados (Portaria 344) | ⚠️ Atenção | **Revisão jurídica específica** antes de ampliar oferta |

---

## 7. Arquivos de referência no projeto

- `backend-dotnet/src/RenoveJa.Infrastructure/Certificates/DigitalCertificateService.cs` — assinatura PAdES
- `supabase/functions/verify/index.ts` — verificação pública
- `supabase/migrations/20260219000001_create_prescriptions_and_logs.sql` — schema prescriptions
- `supabase/migrations/20260221000002_incremental_features.sql` — audit_logs
- `supabase/migrations/20260306120000_audit_logs_old_new_values.sql` — old_values/new_values
- `docs/RENDER_CONFIG_ITI.md` — configuração ITI
