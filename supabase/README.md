# Supabase — RenoveJá

## Estrutura

```
supabase/
├── docs/                    # Documentação
│   ├── AUDITORIA_MIGRATIONS_SCHEMA.md
│   └── MIGRATIONS_README.md
├── functions/               # Edge Functions
│   └── verify/              # Verificação de prescrições (QR + código)
└── migrations/              # Migrations SQL (ordem cronológica)
```

## Documentação

- **Migrations:** `docs/MIGRATIONS_README.md` — ordem e padrões
- **Auditoria:** `docs/AUDITORIA_MIGRATIONS_SCHEMA.md` — status do schema

## Buckets

| Bucket | Público | Uso |
|--------|---------|-----|
| `prescriptions` | Sim | PDFs assinados (download via VALIDAR/frontend) |
| `prescription-images` | Não | Imagens de receita/exame (upload paciente) |
| `certificates` | Não | PFX criptografados dos médicos |

## Edge Function: verify

Valida prescrições por código de 6 dígitos e/ou token QR. Usada pelo frontend de verificação e pelo validar.iti.gov.br.
