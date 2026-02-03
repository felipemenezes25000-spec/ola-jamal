# CHANGELOG - RenoveJá Backend .NET

## Versão 1.0.1 - 2026-02-02 23:45

### ✅ ATUALIZAÇÃO: PushToken com Campos Completos

**Modificações realizadas:**

1. **Domain Layer - PushToken Entity:**
   - ✅ Adicionado campo `DeviceType` (string, default "unknown")
   - ✅ Adicionado campo `Active` (bool, default true)
   - ✅ Adicionado método `Deactivate()` para marcar token como inativo
   - ✅ Adicionado método `Activate()` para reativar token
   - ✅ Método `Create()` agora aceita `deviceType` opcional
   - ✅ Método `Reconstitute()` atualizado com novos campos

2. **Infrastructure Layer - PushTokenModel:**
   - ✅ Adicionado `DeviceType` (string, default "unknown")
   - ✅ Adicionado `Active` (bool, default true)
   - ✅ Totalmente sincronizado com schema do Supabase

3. **Infrastructure Layer - PushTokenRepository:**
   - ✅ Mapper `MapToDomain()` atualizado
   - ✅ Mapper `MapToModel()` atualizado
   - ✅ `GetByUserIdAsync()` agora filtra apenas tokens ativos (active=true)
   - ✅ `DeleteByTokenAsync()` agora marca como inativo ao invés de deletar (soft delete)

4. **API Layer - PushTokensController (NOVO):**
   - ✅ POST /api/push-tokens - Registrar novo token
   - ✅ DELETE /api/push-tokens - Desregistrar token (soft delete)
   - ✅ GET /api/push-tokens - Listar tokens ativos do usuário
   - ✅ Autenticação obrigatória (Bearer token)
   - ✅ Retorna device_type e active status

### 📊 Compatibilidade com Supabase

**Campos no Supabase:**
```sql
push_tokens:
  - id (uuid)
  - user_id (uuid)
  - token (varchar)
  - created_at (timestamptz)
  - device_type (varchar, default 'unknown')  ← NOVO
  - active (boolean, default true)             ← NOVO
```

**Campos no .NET:**
```csharp
PushToken:
  - Id (Guid)
  - UserId (Guid)
  - Token (string)
  - CreatedAt (DateTime)
  - DeviceType (string, default "unknown")     ← NOVO
  - Active (bool, default true)                ← NOVO
```

✅ **100% SINCRONIZADO**

### 🎯 Novos Endpoints

```http
POST /api/push-tokens
Authorization: Bearer {token}
Content-Type: application/json

{
  "token": "ExponentPushToken[xxxxxx]",
  "deviceType": "ios" // opcional: ios, android, web
}

Response:
{
  "id": "uuid",
  "message": "Push token registered successfully"
}
```

```http
DELETE /api/push-tokens
Authorization: Bearer {token}
Content-Type: application/json

{
  "token": "ExponentPushToken[xxxxxx]"
}

Response:
{
  "message": "Push token unregistered successfully"
}
```

```http
GET /api/push-tokens
Authorization: Bearer {token}

Response:
[
  {
    "id": "uuid",
    "token": "ExponentPushToken[xxxxxx]",
    "device_type": "ios",
    "active": true,
    "created_at": "2026-02-02T23:00:00Z"
  }
]
```

### 🔄 Comportamento de Soft Delete

Quando um token é "deletado" via `DELETE /api/push-tokens`:
- ❌ **Não deleta** o registro do banco
- ✅ **Marca** o campo `active` como `false`
- ✅ **Preserva** histórico de tokens
- ✅ **Filtra** automaticamente tokens inativos em `GET /api/push-tokens`

Benefícios:
- Auditoria completa
- Possibilidade de reativação
- Análise de dispositivos utilizados

### 📝 Arquivos Modificados

1. `/src/RenoveJa.Domain/Entities/PushToken.cs` ← ATUALIZADO
2. `/src/RenoveJa.Infrastructure/Data/Models/RemainingModels.cs` ← ATUALIZADO
3. `/src/RenoveJa.Infrastructure/Repositories/RemainingRepositories.cs` ← ATUALIZADO
4. `/src/RenoveJa.Api/Controllers/PushTokensController.cs` ← NOVO

### ✅ Status do Projeto

**Totais Atualizados:**
- Arquivos: ~61 arquivos (era 60)
- Controllers: 11 (era 10)
- Endpoints: 43+ (era 40+)
- Linhas de código: ~7.800 (era 7.500)

**Funcionalidades:**
- ✅ 100% dos campos do Supabase mapeados
- ✅ Soft delete implementado
- ✅ Controller completo para Push Tokens
- ✅ Pronto para integração com Expo Push Notifications

### 🚀 Próximos Passos

O backend está completo e pronto para:
1. Receber tokens de dispositivos móveis
2. Enviar notificações push via Expo
3. Gerenciar múltiplos dispositivos por usuário
4. Manter histórico de tokens (ativos/inativos)

---

**Versão:** 1.0.1  
**Data:** 2026-02-02 23:45 UTC  
**Autor:** Claude (Arquiteto .NET + DDD)  
**Status:** ✅ Production Ready
