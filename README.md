# RenoveJá+

Plataforma de **telemedicina** completa para renovação de receitas, pedidos de exame, consultas por vídeo e emissão de documentos médicos. Fluxo end-to-end: solicitação do paciente → triagem com IA → teleconsulta → emissão de receita/exames/atestado pré-preenchidos por IA → assinatura digital ICP-Brasil → verificação pública via QR Code → controle antifraude. **100% gratuito para a população.**

---

## Funcionalidades principais

### Para o paciente (mobile)
- Solicitar renovação de receita, pedido de exame ou consulta por vídeo
- Videoconsulta com médico em tempo real (Daily.co + WebRTC)
- Receber receitas, exames e atestados assinados digitalmente
- Baixar, visualizar e compartilhar documentos por WhatsApp
- Banner de vencimento ("Receita vence em X dias") + botão Renovar
- Badge de validade (verde/âmbar/vermelho) em cada documento
- Código de verificação visível para farmácia/empregador
- Push notifications: documentos prontos, receita vencendo, documento verificado

### Para o médico (mobile + web)
- Fila de atendimento com triagem automática por IA
- Teleconsulta com transcrição automática (Deepgram) e anamnese IA (GPT-4o)
- **Tela pós-consulta**: receita + exames + atestado pré-preenchidos pela IA
  - 9 pacotes CID (J11, J06, I10, E11, F32, M54, N39, K21, J45)
  - 7 pacotes de exames rápidos (check-up, IST, pré-natal, cardiovascular, renal, hepático, tireoide)
  - Atestado: afastamento, comparecimento ou aptidão com stepper de dias
- Assinatura digital ICP-Brasil (certificado A1 local)
- **Assinatura em lote**: revisar → aprovar → acumular → assinar vários de uma vez
- Fluxo individual (um por um) continua funcionando normalmente
- Plano de cuidados a partir dos exames sugeridos pela IA
- Prontuário eletrônico com compliance CFM 1.638/2002

### Segurança e antifraude
- Assinatura digital ICP-Brasil PAdES (iText7 + BouncyCastle) — qualquer alteração no PDF invalida
- QR Code de verificação pública em todos os documentos
- **Verificação universal**: receitas, atestados e exames via endpoint público
- Validade automática por tipo (receita simples 6m, controlada 30d, antimicrobiana 10d)
- Controle de dispensação: farmacêutico marca como "dispensado" via QR Code
- Bloqueio de reuso: receita controlada = uso único
- Cooldown por medicamento duplicado (30 dias)
- Verificação de sobreposição de atestados
- Log de auditoria LGPD (download, visualização, verificação, dispensação)
- Notificação push ao paciente quando documento é verificado externamente
- Link para validação ICP-Brasil do governo (validar.iti.gov.br)

### Verificação pública (web)
- Farmacêutico ou empregador escaneia QR Code do documento
- Digita código de verificação de 6 dígitos
- Sistema retorna: validade, tipo, médico, CRM, data, status de dispensação
- Botão "Marcar como dispensado" para farmacêuticos
- Funciona para receitas, atestados e pedidos de exame

---

## Stack

| Camada         | Tecnologia |
|---------------|------------|
| Backend       | .NET 8, Clean Architecture, C# |
| Mobile        | Expo 54, React Native, TypeScript |
| Web (médico)  | Vite + React + Tailwind + shadcn/ui, TypeScript |
| Banco         | PostgreSQL (AWS RDS, Npgsql + Dapper) |
| Storage       | AWS S3 (receitas, certificados, avatares, transcrições) |
| Vídeo         | Daily.co (WebRTC + transcrição Deepgram) |
| IA            | OpenAI GPT-4o (anamnese, SOAP, sugestões) · fallback Gemini 2.5 Flash |
| Assinatura    | ICP-Brasil PAdES (iText7 + BouncyCastle) · Suporte futuro VIDaaS (A3 nuvem) |
| PDF           | iText7 (receitas, exames, atestados com QR Code) |
| Push          | Expo Push Notifications |
| Deploy        | AWS (backend + web) · EAS Build (mobile) |
| Monitoramento | Sentry (todos os módulos) |

---

## Arquitetura

```
ola-jamal/
├── backend-dotnet/          # API .NET 8 (Clean Architecture)
│   ├── src/
│   │   ├── RenoveJa.Api/           # Controllers, middleware, DI
│   │   ├── RenoveJa.Application/   # Services, DTOs, interfaces
│   │   ├── RenoveJa.Domain/        # Entities, enums, value objects
│   │   └── RenoveJa.Infrastructure/# Repositories, PDF, certificates, AI
│   └── tests/
├── frontend-mobile/         # App Expo (iOS/Android) — paciente + médico
│   ├── app/                         # Expo Router (file-based routing)
│   │   ├── (patient)/               # Telas do paciente (home, requests, profile)
│   │   ├── (doctor)/                # Telas do médico (queue, consultations)
│   │   ├── request-detail/          # Detalhe do pedido + documentos
│   │   ├── post-consultation-emit/  # Emissão pós-consulta (médico)
│   │   ├── consultation-summary/    # Resumo IA da consulta
│   │   └── video/                   # Videochamada Daily.co
│   ├── components/
│   │   ├── post-consultation/       # PostConsultationScreen, ConsultationDocumentsCard,
│   │   │                            # ExpiringDocsBanner, DocumentValidityBadge
│   │   ├── prontuario/              # AnamnesisCard, SoapNotesCard
│   │   ├── video/                   # VideoCallScreenInner
│   │   └── ui/                      # AppButton, FormSection, etc.
│   ├── lib/
│   │   ├── data/                    # cidPackages.ts (9 CIDs + 7 exam packages)
│   │   ├── domain/                  # anamnesis, statusLabels, assistantIntelligence
│   │   └── hooks/                   # useRequestsQuery, useRequestDetailQuery
│   └── types/                       # postConsultation.ts, database.ts
├── frontend-web/            # Portal médico + verificação pública
│   ├── src/
│   │   ├── pages/doctor/            # DoctorPostConsultationEmit, DoctorConsultationSummary,
│   │   │                            # DoctorVideoCall, DoctorRequestDetail, etc.
│   │   ├── pages/Verify.tsx         # Verificação universal de documentos
│   │   ├── api/verify.ts            # verifyDocument, dispenseDocument
│   │   └── services/                # doctorApi barrel, doctor-api-*.ts
├── infra/                   # Terraform (AWS: ECS, RDS, S3, CloudFront, WAF)
├── docs/                    # Documentação central
└── scripts/                 # Scripts auxiliares
```

---

## Fluxos principais

### Fluxo de consulta completo
```
Paciente solicita consulta
  → IA faz triagem automática
  → Médico aceita na fila
  → Teleconsulta (Daily.co + Deepgram transcrição + GPT-4o anamnese)
  → Médico finaliza → vê resumo IA (anamnese, SOAP, sugestões)
  → Clica "Emitir documentos"
  → Tela pós-consulta: receita + exames + atestado pré-preenchidos
  → Médico revisa e assina (ICP-Brasil)
  → Paciente recebe push + vê documentos no app
  → Baixa PDF e envia por WhatsApp
```

### Fluxo de verificação (farmácia/empregador)
```
Farmacêutico escaneia QR Code do PDF
  → Abre renovejasaude.com.br/verify/{id}
  → Digita código de 6 dígitos
  → Sistema valida: assinatura, validade, dispensação prévia
  → Mostra: ✅ Válido ou ⚠️ Já dispensado ou ❌ Vencido
  → Farmacêutico clica "Marcar como dispensado"
  → Paciente recebe push "Seu documento foi verificado"
```

### Fluxo antifraude
```
Documento emitido → expires_at calculado automaticamente
  → Receita simples: 6 meses / Controlada: 30 dias / Antimicrobiana: 10 dias
  → access_code SHA-256 gerado
  → max_dispenses definido (controlada = 1)
  → Cada download/visualização/verificação logado (auditoria LGPD)
  → Dispensação registrada com nome da farmácia
  → Próxima verificação mostra "⚠️ Já dispensado"
```

---

## API — Endpoints principais

### Pós-consulta
| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/api/post-consultation/emit` | Emitir receita + exames + atestado (médico) |
| GET | `/api/post-consultation/{id}/documents` | Listar documentos da consulta (paciente/médico) |
| POST | `/api/post-consultation/documents/{id}/token` | Token temporário para download |
| GET | `/api/post-consultation/documents/{id}/download` | Download do PDF |

### Verificação universal
| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/api/documents/verify` | Verificar autenticidade (público) |
| POST | `/api/documents/{id}/dispense` | Marcar como dispensado (farmácia) |

### Assinatura em lote
| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/api/batch-signature/{id}/review` | Marcar como revisado |
| POST | `/api/batch-signature/{id}/approve-for-signing` | Aprovar para assinatura |
| GET | `/api/batch-signature/pending` | Listar aprovados pendentes |
| POST | `/api/batch-signature/sign` | Assinar em lote |

### Requests (existentes)
| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/api/requests/prescription` | Solicitar receita |
| POST | `/api/requests/exam` | Solicitar exame |
| POST | `/api/requests/consultation` | Solicitar consulta |
| POST | `/api/requests/{id}/sign` | Assinar individualmente |
| GET | `/api/requests/{id}/document` | Download do PDF (legado) |
| POST | `/api/prescriptions/verify` | Verificação de receita (legado) |

---

## Quick start

### Backend
```bash
cd backend-dotnet
dotnet restore && dotnet build
cd src/RenoveJa.Api && dotnet run
```
API em `http://localhost:5000` · Swagger em `/swagger` (apenas Development).

### Mobile
```bash
cd frontend-mobile
npm install
cp .env.example .env   # Preencha EXPO_PUBLIC_API_URL
npx expo start
```

### Web
```bash
cd frontend-web
npm install
cp .env.example .env   # Preencha VITE_API_URL
npm run dev
```

### Infra (AWS)
```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
terraform init && terraform plan && terraform apply
```

---

## Variáveis de ambiente

- **Backend:** `backend-dotnet/docs/VARIAVEIS_AMBIENTE.md` e `backend-dotnet/README.md`
- **Mobile:** `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, etc. — ver `.env.example`
- **Web:** `VITE_API_URL`, `VITE_FORMSPREE_FORM_ID`, `VITE_SENTRY_DSN` — ver `.env.example`

Nunca commitar `.env` ou chaves; usar `.env.example` como modelo.

---

## Testes

| Módulo | Comando |
|--------|---------|
| Backend | `cd backend-dotnet && dotnet test` |
| Mobile  | `cd frontend-mobile && npm run test -- --watchAll=false` |
| Web     | `cd frontend-web && npm run test:run` |

---

## Deploy

| Componente | Onde | Observação |
|-----------|------|------------|
| Backend   | AWS ECS Fargate (Docker) | `backend-dotnet/Dockerfile` |
| Web       | AWS CloudFront + S3 | Build: `npm run build` |
| Mobile    | EAS Build | `frontend-mobile/eas.json` |
| Banco     | AWS RDS PostgreSQL | Migrations automáticas no startup |
| Infra     | Terraform | `infra/*.tf` |

---

## Compliance e regulamentação

- **CFM 1.638/2002** — Prontuário eletrônico: anamnese, exame físico, hipóteses diagnósticas, CID, tratamento, evolução com timestamps, identificação do profissional com CRM
- **CFM 2.299/2021** — Telemedicina: videoconsulta, transcrição, consentimento
- **ANVISA** — Validade de receitas: simples (6 meses), controlada (30 dias), antimicrobiana (10 dias)
- **MP 2.200-2/2001** — Assinatura digital ICP-Brasil com validade jurídica plena
- **LGPD** — Log de acesso a documentos, retenção mínima 20 anos, consentimento registrado

---

## Pendências futuras

- [ ] Integração VIDaaS VALID (certificado A3 nuvem — assinatura assíncrona com push)
- [ ] Envio WhatsApp real via API Meta Business (botões visuais já implementados com TODO)
- [ ] Frontend web para assinatura em lote (backend pronto, UI pendente)

---

## Documentação

Índice completo: **[docs/README.md](docs/README.md)**

---

**RenoveJá+** — .NET 8 · Expo 54 · PostgreSQL · AWS · Daily.co · OpenAI · Gemini · ICP-Brasil · Sentry
