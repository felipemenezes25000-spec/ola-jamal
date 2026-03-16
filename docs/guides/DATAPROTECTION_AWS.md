# DataProtection em containers (ECS)

O ASP.NET Core DataProtection usa o filesystem por padrão. Em containers (ECS Fargate), o diretório `/home/appuser/.aspnet/DataProtection-Keys` não persiste entre restarts, gerando o aviso:

```
Storing keys in a directory '...' that may not be persisted outside of the container.
```

## Impacto

- **Cookies de autenticação / antiforgery** podem invalidar após restart do container.
- Usuários podem precisar fazer login novamente após deploy.

## Solução (opcional)

Se a aplicação depender de sessões/cookies persistentes entre restarts, configure armazenamento externo:

### Opção 1: S3 (recomendado para AWS)

```csharp
// Program.cs
builder.Services.AddDataProtection()
    .PersistKeysToAWSSystemsManager("/renoveja/dataprotection/keys");
// ou
builder.Services.AddDataProtection()
    .PersistKeysToAwsS3(bucket, "dataprotection-keys/");
```

Requer pacote `AWSSDK.Extensions.NETCore.Setup` e credenciais IAM.

### Opção 2: Redis (se já usar ElastiCache)

```csharp
builder.Services.AddDataProtection()
    .PersistKeysToStackExchangeRedis(ConnectionMultiplexer.Connect(redisConnectionString), "DataProtection-Keys");
```

### Opção 3: PostgreSQL

Persistir em tabela dedicada via `IDataProtectionKeyStore` customizado.

---

**Nota:** Se o app não usa antiforgery ou cookies sensíveis entre restarts, o aviso pode ser ignorado.
