# CLAUDE.md — Guia de trabalho (RenoveJá+)

Objetivo: entregar mudanças **pequenas, seguras e verificáveis** neste monorepo.

---

## Estrutura

```
ola-jamal/
├── backend-dotnet/   # API .NET 8 — Clean Architecture (Domain / Application / Infrastructure / Api)
├── frontend-mobile/  # Expo 54 + React Native (iOS/Android)
├── frontend-web/     # Vite + React (landing, portal médico, verificação)
└── infra/            # Terraform (AWS ECS, RDS, S3, CloudFront, WAF)
```

- **Banco:** PostgreSQL via AWS RDS (Npgsql/Dapper). **Sem Supabase.**
- **Storage:** AWS S3 (`S3StorageService` — buckets: prescriptions, certificates, avatars, transcripts).

---

## Stack (referência rápida)

| Camada     | Tecnologia |
|-----------|------------|
| Banco     | PostgreSQL — `ConnectionStrings__DefaultConnection` |
| Storage   | AWS S3 |
| IA        | OpenAI GPT-4o → fallback Gemini 2.5 Flash |
| Transcrição | Daily.co (Deepgram) — não Whisper como principal |
| Vídeo     | Daily.co |
| Assinatura | ICP-Brasil PAdES (iText7 + BouncyCastle) |

---

## Regras de execução

1. **Plano curto** antes de alterar arquivos.
2. **Mudanças mínimas** e focadas no escopo pedido.
3. **Não quebrar contratos de API** sem avisar.
4. **Validar** com lint / test / build no módulo afetado.
5. **Responder** com: Resumo · Arquivos alterados · Como testar · Riscos/pendências.

---

## Comandos por módulo

| Módulo | Lint / typecheck | Testes | Build |
|--------|-------------------|--------|--------|
| frontend-web   | `npm run lint` | `npm run test:run` | `npm run build` |
| frontend-mobile| `npm run lint` + `npm run typecheck` | `npm run test -- --watchAll=false` | — |
| backend-dotnet | — | `dotnet test` | `dotnet build` |

---

## Padrões de qualidade

- Funções pequenas e tipadas; evitar `any` sem justificativa.
- Estados de loading, empty e erro em toda UI que consome dados.
- Não introduzir dependências novas sem necessidade.
- **Nunca** referências a Supabase — stack é AWS RDS + S3.

---

## Checklist antes de concluir

- [ ] Escopo atendido
- [ ] Nenhum arquivo não relacionado alterado
- [ ] Lint / test / build do módulo principal executados
- [ ] Instruções de validação na resposta

Documentação geral: **[README.md](README.md)** e **[docs/README.md](docs/README.md)**.
