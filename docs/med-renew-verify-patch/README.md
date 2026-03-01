# Patch: Verificação de Receita para med-renew

Estes arquivos replicam as alterações de verificação de receita (validação no servidor, dados reais, CRM completo) para o repositório **med-renew**.

## Como usar

1. **No med-renew (clone o repo primeiro, se for privado):**
   - `git clone https://github.com/felipemenezes25000-spec/med-renew.git`
   - Entre na pasta do projeto.

2. **Backend:**
   - Copie o conteúdo de `VerificationDtos-addition.cs` e **adicione** ao final do arquivo de DTOs de verificação (ajuste o namespace para o do med-renew).
   - Crie o controller `PrescriptionsController.cs` na pasta de Controllers da API; **substitua** os namespaces `RenoveJa.*` pelos do med-renew (ex.: `MedRenew.Application`, `MedRenew.Domain`, `MedRenew.Api`). Ajuste o enum de status cancelado se for diferente de `RequestStatus.Cancelled`.

3. **Frontend:**
   - Substitua o conteúdo de `src/api/verify.ts` (ou o caminho equivalente) pelo conteúdo de `api/verify.ts` desta pasta.
   - Atualize a página de verificação (`Verify.tsx`) conforme o guia em `../MIGRATION_VERIFY_TO_MED_RENEW.md`: exibir apenas dados da API, CRM completo, datas reais, sem fallbacks.

4. **Variáveis:** Configure `VITE_API_URL` no frontend e a base URL da API no backend.

Guia completo: [MIGRATION_VERIFY_TO_MED_RENEW.md](../MIGRATION_VERIFY_TO_MED_RENEW.md).
