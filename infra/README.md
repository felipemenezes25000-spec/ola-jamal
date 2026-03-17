# Infraestrutura AWS — RenoveJá+

Terraform para AWS: VPC, RDS (PostgreSQL), S3, ECS Fargate, CloudFront, WAF. Documentação geral: [README principal](../README.md) · [docs/](../docs/README.md).

---

## Pré-requisitos

### 1. Instalar ferramentas

```powershell
winget install HashiCorp.Terraform
winget install Amazon.AWSCLI
# Reinicie o terminal após instalar
```

### 2. Configurar credenciais AWS

```powershell
aws configure
# AWS Access Key ID:     (da sua conta)
# AWS Secret Access Key: (da sua conta)
# Default region:        sa-east-1
# Default output:        json
```

### 3. Preencher variáveis

```powershell
cp terraform.tfvars.example terraform.tfvars
# Edite terraform.tfvars com seus valores reais
```

### 4. Aplicar

```powershell
cd infra
terraform init
terraform plan    # revise o que será criado
terraform apply   # confirme com "yes"
```

---

## Estrutura

```
infra/
├── main.tf              # Provider AWS
├── variables.tf         # Variáveis de entrada
├── terraform.tfvars.example  # Template — copie para terraform.tfvars
├── vpc.tf               # VPC, subnets, NAT Gateway, Security Groups
├── database.tf          # RDS PostgreSQL + ElastiCache Redis
├── storage.tf           # Buckets S3 (prescriptions, certificates, avatars, transcripts, frontend)
├── ecs.tf               # ECR + ECS Fargate + ALB + Auto-scaling
├── cdn.tf               # CloudFront + SPA rewrite function
├── waf.tf               # WAF v2 (regras managed + rate limit)
└── outputs.tf           # URLs e endpoints de saída
```

---

## Verificar o que existe na AWS (AWS CLI)

```powershell
cd infra/scripts
.\aws-check-and-deploy.ps1
```

Lista RDS, S3, ECS e ECR na região `sa-east-1` e indica o que falta. Depois de subir a infra (ou se já existir), aplique o schema no Postgres (ver passo 2 abaixo).

## Aplicar schema no RDS

- **Banco novo:** use `infra/schema.sql` (cria todas as tabelas).
- **Banco já existente:** rode as migrations em `infra/migrations/` nesta ordem:
  1. `20260316_requests_missing_columns.sql`
  2. `20260316_patients_consent_records.sql`
  3. `20260316_encounters_medical_ai_careplans.sql`
  4. `20260316_fix_care_plans_outbox_schema.sql` (corrige erros 42703 nos logs do MigrationRunner)

  Ou use o script: `cd infra/scripts; $env:DATABASE_URL="Host=...;Database=renoveja;Username=postgres;Password=..."; .\run-fix-schema-migration.ps1`

Formas de rodar:
- **RDS Query Editor (console AWS):** RDS → sua instância → Query Editor → colar o SQL e executar.
- **psql:** `$env:PGPASSWORD="SENHA"; psql -h ENDPOINT_RDS -U postgres -d renoveja -f infra/schema.sql`

Obter o endpoint do RDS: `aws rds describe-db-instances --region sa-east-1 --query "DBInstances[?DBInstanceIdentifier=='renoveja-postgres'].Endpoint.Address" --output text`

## CORS (origens permitidas)

A API usa `Cors:AllowedOrigins` para permitir requisições de `medico.renovejasaude.com.br`, `admin.renovejasaude.com.br`, etc. O `infra/task-definition.json` já inclui as env vars `Cors__AllowedOrigins__0` a `__4`.

Para gerenciar CORS via AWS Parameter Store (alterar sem redeploy):

```powershell
cd infra/scripts
.\ssm-set-cors.ps1
```

Depois, adicione os parâmetros em `secrets` na task-definition e remova as env vars de CORS do `environment` (ou mantenha as env vars — elas têm precedência sobre appsettings).

## Google OAuth (login)

O backend precisa de `Google__ClientId` e `Google__AndroidClientId` no SSM para validar tokens do app mobile. O `task-definition.json` já referencia ambos em `secrets`.

Para criar/atualizar os parâmetros no SSM:

```powershell
cd infra/scripts
.\ssm-set-google-auth.ps1
```

O script usa os Client IDs padrão do projeto. Para valores diferentes, passe `-GoogleClientId` e `-GoogleAndroidClientId`.

## Fases de deploy

Após o `terraform apply` inicial, siga o plano de migração em
`docs/infra/PLANO_RECUPERACAO_ESCALABILIDADE.md` para migrar dados e trocar DNS.
