# Cutover: Requests → Encounters/Documents (Fase 1)

## Estado atual (pós-Fase 1)

- **Requests** permanecem o fluxo comercial/operacional (status, pagamento, assinatura, entrega).
- **Sync clínico** roda automaticamente após assinatura: cria `Encounter` + `MedicalDocument` com `source_request_id`.
- **Doctor Read API** disponível: `GET /api/fhir-lite/doctor/patient/{id}/summary|encounters|documents`.
- **Fallback** em `ClinicalRecordService.GetPatientSummaryAsync`: se não houver encounters/documents, monta resumo a partir de requests.

## Feature flags (appsettings)

| Flag | Default | Uso |
|------|---------|-----|
| `FeatureFlags:ClinicalSyncSourceRequest` | true | Sync pós-assinatura com source_request_id (sempre ativo na Fase 1). |
| `FeatureFlags:DoctorReadFhirLite` | true | Endpoints Doctor Read (sempre ativos na Fase 1). |
| `FeatureFlags:UseClinicalModelAsSourceOfTruth` | false | Quando true, timeline do prontuário ignora fallback de requests. |

## Plano de cutover gradual

1. **Fase 1 (atual)**  
   - Sync ativo, Doctor Read ativo, fallback ativo.  
   - Frontend médico pode consumir `/api/requests/by-patient/*` ou `/api/fhir-lite/doctor/patient/*`.

2. **Fase 2 (opcional)**  
   - Migrar telas `doctor-patient` e `doctor-patient-summary` para Doctor Read.  
   - Manter fallback para dados antigos.

3. **Fase 3 (cutover)**  
   - Ativar `UseClinicalModelAsSourceOfTruth: true`.  
   - Remover ou desativar `BuildSummaryFromRequestsAsync` em `ClinicalRecordService`.  
   - Garantir backfill de requests assinados antigos para encounters/documents antes do cutover.

## Backfill

Para requests assinados antes da migration `20260304100000_clinical_provenance_source_request.sql`:

- Rodar job/script que, para cada request com `status = 'signed'` e sem `medical_document` com `source_request_id` correspondente, chame `SignedRequestClinicalSyncService.SyncSignedRequestAsync`.
- O sync é idempotente: não duplica se o documento já existir.

### API de backfill (admin)

**Endpoint:** `POST /api/admin/clinical-backfill/signed-requests`

- **Autorização:** admin (Bearer token)
- **Query:** `?limit=N` (opcional) — limita quantos processar por execução
- **Resposta:** `{ totalSigned, synced, skipped, failed, message }`

**Dry-run:** `GET /api/admin/clinical-backfill/signed-requests-pending` — lista requests pendentes de sync

**Exemplo (curl):**
```bash
curl -X POST "https://api.renovejasaude.com.br/api/admin/clinical-backfill/signed-requests?limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
