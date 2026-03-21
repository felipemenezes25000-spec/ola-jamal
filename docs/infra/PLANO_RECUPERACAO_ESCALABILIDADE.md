# Plano de Recuperação de Desastres e Escalabilidade — RenoveJá+ Saúde Municipal

## 1. Backup e recuperação

### 1.1 Backup automático
- **Frequência**: diário (AWS RDS automated backups)
- **Retenção**: 30 dias (plano Pro) / 7 dias (plano Free)
- **Tipo**: incremental + snapshot completo semanal
- **Armazenamento**: redundante (multi-AZ na infra AWS RDS)

### 1.2 RPO e RTO
- **RPO** (Recovery Point Objective): < 24 horas
  - Com WAL archiving habilitado: < 1 hora
- **RTO** (Recovery Time Objective): < 4 horas
  - Restauração de snapshot: ~30 minutos
  - Reconfiguração de serviços: ~1-2 horas
  - Validação de integridade: ~1 hora

### 1.3 Procedimento de restauração
1. Identificar ponto de falha (via logs)
2. Acessar AWS RDS Console → Databases → Snapshots
3. Selecionar snapshot mais recente antes da falha
4. Restaurar para instância temporária para validação
5. Confirmar integridade dos dados (contagem de registros, último atendimento)
6. Executar swap para produção
7. Notificar equipe e secretaria de saúde
8. Registrar incidente no log de operações

### 1.4 Teste de restauração
- **Frequência**: mensal
- **Procedimento**: restaurar backup em instância de teste, validar dados, documentar resultado
- **Responsável**: equipe técnica RenoveJá

## 2. Continuidade de serviço

### 2.1 Cenários de falha

| Cenário | Impacto | Mitigação | Tempo recuperação |
|---------|---------|-----------|-------------------|
| Queda da API (AWS) | API indisponível | Auto-restart, health check, ECS | 2-5 minutos |
| Queda do RDS | Banco indisponível | Failover multi-AZ + restore de backup | 30min - 2h |
| Queda do frontend na AWS (web) | Frontend web offline | CDN redundante (CloudFront) | 5-15 minutos |
| Corrupção de dados | Dados inconsistentes | Restaurar backup | 1-4 horas |
| Ataque/invasão | Dados comprometidos | Backup limpo + reset credenciais | 2-8 horas |

### 2.2 Monitoramento
- **Health check**: `/api/health` verificado a cada 30 segundos
- **Uptime monitoring**: serviço externo (ex: UptimeRobot, Better Uptime)

## 3. Plano de escalabilidade

### 3.1 Estado atual (MVP/Piloto)

| Componente | Atual | Capacidade |
|-----------|-------|------------|
| API (.NET) | AWS ECS Fargate | 1 instância, conforme task definition |
| Banco | AWS RDS t3.micro | 20GB, dev/staging |
| Frontend Web | AWS (S3 + CloudFront) | CDN global |
| Mobile | Expo/React Native | Build local |

### 3.2 Migração para produção (5-35 UBS)

| Componente | Recomendado | Custo estimado |
|-----------|-------------|----------------|
| API (.NET) | AWS ECS/App Runner (já na conta) | Custo conforme uso |
| Banco | AWS RDS t3.small | 100GB, produção |
| Frontend Web | AWS CloudFront + S3 (já na conta) | Custo conforme uso |
| CDN/Assets | AWS S3 | Incluso |
| Monitoramento | CloudWatch | R$50-100/mês |
| **Total estimado** | | **R$455-655/mês** |

### 3.3 Escala municipal completa (35+ UBS, 500+ usuários)

| Componente | Recomendado | Custo estimado |
|-----------|-------------|----------------|
| API (.NET) | AWS ECS / Azure App Service | R$500-1500/mês |
| Banco | AWS RDS t3.medium+ | R$500-1000/mês |
| Cache | Redis (ElastiCache) | R$200-400/mês |
| CDN | CloudFront | R$100/mês |
| Monitoramento | CloudWatch + Datadog | R$300-600/mês |
| Backup extra | S3 cross-region | R$50-100/mês |
| **Total estimado** | | **R$1.650-3.600/mês** |

### 3.4 Escalabilidade horizontal
- API .NET é **stateless** — escala com múltiplas instâncias atrás de load balancer
- Banco PostgreSQL suporta connection pooling (PgBouncer (configurar no RDS Proxy))
- SignalR suporta backplane Redis para múltiplas instâncias
- Assets estáticos em CDN (AWS S3 + CloudFront)

## 4. Contato de emergência

- **Equipe técnica**: a definir
- **AWS Support:** console.aws.amazon.com
- **AWS Support**: via console

## 5. Revisão

Este plano deve ser revisado a cada 3 meses ou após qualquer incidente significativo.

**Última revisão**: Março 2026
**Próxima revisão**: Junho 2026
