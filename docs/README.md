# Documentação — RenoveJá+

Índice central da documentação do projeto. Use este arquivo para navegar por **guias**, **arquitetura**, **compliance** e **troubleshooting**.

> **Stack:** .NET 8 · PostgreSQL (RDS) · AWS S3 · Expo 54 · Vite/React · Mercado Pago · Daily.co · OpenAI/Gemini · ICP-Brasil

Voltar ao repositório: [README principal](../README.md) · [CLAUDE.md](../CLAUDE.md)

---

## Por categoria

### [guides/](guides/) — Tutoriais e guias operacionais

| Documento | Descrição |
|-----------|-----------|
| [QUICK_START.md](guides/QUICK_START.md) | Como rodar backend e links rápidos |
| [DEPLOY_AND_TEST.md](guides/DEPLOY_AND_TEST.md) | Deploy e testes em produção |
| [DOCKER_AWS_VALIDACAO.md](guides/DOCKER_AWS_VALIDACAO.md) | Validação Docker para AWS (ECS) |
| [BUILD_APK_GITHUB.md](guides/BUILD_APK_GITHUB.md) | Build APK via GitHub Actions |
| [CONFIG_ITI.md](guides/CONFIG_ITI.md) | Configuração na AWS para assinatura ITI/Adobe |
| [APP_NO_CELULAR_EXPO.md](guides/APP_NO_CELULAR_EXPO.md) | Rodar app no celular com Expo |
| [EXPO_GO.md](guides/EXPO_GO.md) | Uso do Expo Go |
| [EXPO_VALIDACAO.md](guides/EXPO_VALIDACAO.md) | Validação Expo |
| [LOGIN_GOOGLE_PASSO_A_PASSO.md](guides/LOGIN_GOOGLE_PASSO_A_PASSO.md) | Login com Google (passo a passo) |
| [TUTORIAL_LOGIN_GOOGLE_EAS.md](guides/TUTORIAL_LOGIN_GOOGLE_EAS.md) | Login Google em builds EAS (Expo Dashboard + Firebase) |
| [GOOGLE_CLOUD_CHECKLIST.md](guides/GOOGLE_CLOUD_CHECKLIST.md) | Checklist Google Cloud OAuth |
| [TUTORIAL_VERIFICACAO_RECEITA.md](guides/TUTORIAL_VERIFICACAO_RECEITA.md) | Tutorial verificação de receita (QR Code) |
| [TUTORIAL_NAVEGADOR_VERIFICACAO.md](guides/TUTORIAL_NAVEGADOR_VERIFICACAO.md) | Verificação no navegador passo a passo |
| [VERIFY_DEPLOY.md](guides/VERIFY_DEPLOY.md) | Deploy do fluxo de verificação |

### [architecture/](architecture/) — Arquitetura e fluxos

| Documento | Descrição |
|-----------|-----------|
| [ANALISE_PONTA_A_PONTA.md](architecture/ANALISE_PONTA_A_PONTA.md) | Análise ponta a ponta: arquitetura, stack, rotas, riscos |
| [FLUXO_RECEITA_TELAS_E_STATUS.md](architecture/FLUXO_RECEITA_TELAS_E_STATUS.md) | Fluxo completo de receita, telas e status |

### [compliance/](compliance/) — LGPD e contratos

| Documento | Descrição |
|-----------|-----------|
| [RIPD_RENOVEJA.md](compliance/RIPD_RENOVEJA.md) | Relatório de Impacto à Proteção de Dados |
| [ROPA_LGPD_RENOVEJA.md](compliance/ROPA_LGPD_RENOVEJA.md) | Registro de Operações de Tratamento |
| [CHECKLIST_LGPD_ANPD.md](compliance/CHECKLIST_LGPD_ANPD.md) | Checklist LGPD/ANPD |
| [CHECKLIST_CDC_PROCON_CONTRATOS.md](compliance/CHECKLIST_CDC_PROCON_CONTRATOS.md) | Checklist CDC/Procon |
| [CHECKLIST_PAGAMENTOS_PUBLICIDADE_IA.md](compliance/CHECKLIST_PAGAMENTOS_PUBLICIDADE_IA.md) | Pagamentos, publicidade e IA |
| [CONFORMIDADE_JURIDICA_DOCUMENTOS_CLINICOS.md](compliance/CONFORMIDADE_JURIDICA_DOCUMENTOS_CLINICOS.md) | Conformidade jurídica de documentos clínicos |
| [INVENTARIO_DADOS_PESSOAIS.md](compliance/INVENTARIO_DADOS_PESSOAIS.md) | Inventário de dados pessoais |
| [DPO_NOMEACAO_PUBLICACAO.md](compliance/DPO_NOMEACAO_PUBLICACAO.md) | DPO — nomeação e publicação |
| [PLANO_RESPOSTA_INCIDENTES.md](compliance/PLANO_RESPOSTA_INCIDENTES.md) | Plano de resposta a incidentes |
| [PLANO_RESPOSTA_INCIDENTES_LGPD.md](compliance/PLANO_RESPOSTA_INCIDENTES_LGPD.md) | Plano específico LGPD |
| [POLITICA_ESTORNO_CONTESTACAO.md](compliance/POLITICA_ESTORNO_CONTESTACAO.md) | Política de estorno e contestação |
| [DPA_MERCADO_PAGO_RESUMO.md](compliance/DPA_MERCADO_PAGO_RESUMO.md) | DPA Mercado Pago (resumo) |

### [features/](features/) — Funcionalidades

| Documento | Descrição |
|-----------|-----------|
| [ADMIN_PAINEL.md](features/ADMIN_PAINEL.md) | Painel administrativo |
| [PUSH_NOTIFICATIONS.md](features/PUSH_NOTIFICATIONS.md) | Push notifications (fluxo e implementação) |
| [PUSH_NOTIFICATIONS_SPEC.md](features/PUSH_NOTIFICATIONS_SPEC.md) | Especificação técnica de push |
| [ASSISTANT_NAVIGATION.md](features/ASSISTANT_NAVIGATION.md) | Navegação do assistente (Dra. Renova) |

### [infra/](infra/) — Infraestrutura

| Documento | Descrição |
|-----------|-----------|
| [CUTOVER_REQUESTS_TO_CLINICAL.md](infra/CUTOVER_REQUESTS_TO_CLINICAL.md) | Cutover de requests para modelo clínico |
| [MIGRATION_VERIFY_TO_MED_RENEW.md](infra/MIGRATION_VERIFY_TO_MED_RENEW.md) | Migração do fluxo Verify para MedRenew |
| [PLANO_RECUPERACAO_ESCALABILIDADE.md](infra/PLANO_RECUPERACAO_ESCALABILIDADE.md) | Plano de recuperação e escalabilidade |

### [technical/](technical/) — Documentação técnica

| Documento | Descrição |
|-----------|-----------|
| [ANALISE_COMPLETA_RENOVEJA.md](technical/ANALISE_COMPLETA_RENOVEJA.md) | Análise completa do repositório |
| [ENV_SEPARACAO.md](technical/ENV_SEPARACAO.md) | Separação de variáveis de ambiente por módulo |
| [LOGS_CONVENCAO.md](technical/LOGS_CONVENCAO.md) | Convenção de logs estruturados |
| [triage-ai-guardrails.md](technical/triage-ai-guardrails.md) | Guardrails da triagem IA |
| [VALIDACAO_TRIAGEM_CONDUTA.md](technical/VALIDACAO_TRIAGEM_CONDUTA.md) | Validação triagem/conduta médica |
| [WHATSAPP_ENVIO_DOCUMENTO.md](technical/WHATSAPP_ENVIO_DOCUMENTO.md) | Envio de documento via WhatsApp |
| [GANHOS_E_OPCIONAIS.md](technical/GANHOS_E_OPCIONAIS.md) | Ganhos e melhorias opcionais |
| [CURSOR_DOCS_SEED.md](technical/CURSOR_DOCS_SEED.md) | Links de documentação para Cursor |

### [troubleshooting/](troubleshooting/) — Resolução de problemas

| Documento | Descrição |
|-----------|-----------|
| [ANDROID_STUDIO_ERROS.md](troubleshooting/ANDROID_STUDIO_ERROS.md) | Erros comuns do Android Studio |
| [BUGS_DARK_LIGHT_MODE.md](troubleshooting/BUGS_DARK_LIGHT_MODE.md) | Bugs de dark/light mode |

### [deploy/](deploy/) — Deploy

Documentação de deploy do frontend-web está na AWS (CloudFront/S3 ou Amplify). Ver também [DEPLOY_AND_TEST.md](guides/DEPLOY_AND_TEST.md).

### [setup/](setup/) — Configuração inicial

| Documento | Descrição |
|-----------|-----------|
| [CONFIG_GOOGLE_OAUTH.md](setup/CONFIG_GOOGLE_OAUTH.md) | Configuração Google OAuth |

---

## Documentação por módulo

- **Backend:** `backend-dotnet/docs/` — variáveis de ambiente, debug, Mercado Pago, assinatura PAdES ITI, fluxo de receita, transcrição, Google Login
- **Mobile:** `frontend-mobile/docs/` — diagnóstico de crashes, mapa de validação
