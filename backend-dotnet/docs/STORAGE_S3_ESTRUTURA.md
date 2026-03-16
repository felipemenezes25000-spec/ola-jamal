# Estrutura S3 — RenoveJá+

Todos os arquivos (receitas, exames, anexos do paciente, gravações, transcrições, certificados, avatares) são armazenados na AWS S3 com **prefixos padronizados** para localização rápida e auditoria.

## Convenção de paths (keys)

Paths são **case-sensitive** e usam `/` como separador. `{id:N}` = Guid sem hífens.

### Pedidos (solicitações — receita ou exame)

| Conteúdo | Path (exemplo) | Bucket |
|----------|----------------|--------|
| **Anexos receita** (imagens enviadas pelo paciente) | `pedidos/receita/anexos/{userId:N}/{yyyyMMddHHmmss}-{guid:N}.{ext}` | Prescriptions |
| **Anexos exame** (imagens do pedido antigo / anexos) | `pedidos/exame/anexos/{userId:N}/{yyyyMMddHHmmss}-{guid:N}.{ext}` | Prescriptions |
| **PDF receita gerado** (pré-assinatura) | `pedidos/{requestId:N}/receita/gerado/receita-{requestId:N}.pdf` | Prescriptions |
| **PDF receita assinado** | `pedidos/{requestId:N}/receita/assinado/receita-{requestId:N}.pdf` | Prescriptions |
| **PDF exame assinado** | `pedidos/{requestId:N}/exame/assinado/pedido-exame-{requestId:N}.pdf` | Prescriptions |

### Consultas (vídeo)

| Conteúdo | Path (exemplo) | Bucket |
|----------|----------------|--------|
| **Transcrição .txt** | `consultas/{requestId:N}/transcricao/transcricao-{requestId:N}.txt` | Transcripts |
| **Gravação vídeo** (Daily.co) | `consultas/{requestId:N}/gravacao/consulta-{requestId:N}-{recordingId}.mp4` | Transcripts |
| **Chunks de áudio** (fallback transcrição) | `consultas/{requestId:N}/gravacao-chunks/{yyyyMMddHHmmss}-{guid:N}.{ext}` | Transcripts |
| **Notas SOAP** (IA pós-consulta) | `consultas/{requestId:N}/notas-soap/soap-notes-{requestId:N}.json` | Transcripts |

### Usuários

| Conteúdo | Path (exemplo) | Bucket |
|----------|----------------|--------|
| **Avatar** | `usuarios/{userId:N}/avatar/{fileName}` | Avatars |
| **Certificado digital** (PFX criptografado) | `usuarios/{doctorProfileId:N}/certificados/{guid}.pfx.enc` | Certificates |

### Planos de cuidado

| Conteúdo | Path (exemplo) | Bucket |
|----------|----------------|--------|
| **Anexo de tarefa** | `planos-de-cuidado/{carePlanId:N}/tarefas/{taskId:N}/anexos/{guid:N}.{ext}` | Prescriptions |

---

## Buckets (variáveis de ambiente)

- **Prescriptions** (`AWS_S3_PRESCRIPTIONS_BUCKET`): pedidos (anexos, PDFs), planos de cuidado.
- **Transcripts** (`AWS_S3_TRANSCRIPTS_BUCKET`): transcrições e gravações de consulta.
- **Certificates** (`AWS_S3_CERTIFICATES_BUCKET`): certificados digitais (PFX).
- **Avatars** (`AWS_S3_AVATARS_BUCKET`): fotos de perfil.

---

## Paths legados (reconhecidos)

Para compatibilidade com dados já existentes, o serviço de storage reconhece também:

- `prescription-images/`, `receitas/`, `signed/` → Prescriptions
- `transcripts/`, `recordings/` → Transcripts
- `certificates/` → Certificates
- `avatars/` → Avatars
- `careplans/` → Prescriptions

Novos uploads passam a usar **apenas** os paths da tabela acima.
