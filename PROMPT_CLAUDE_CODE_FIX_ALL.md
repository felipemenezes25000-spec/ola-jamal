Você é um engenheiro sênior full-stack corrigindo bugs no projeto RenoveJá+ (telemedicina brasileira). O projeto está no diretório atual.

Stack: Expo/React Native (frontend-mobile), Vite/React (frontend-web), .NET 8 (backend-dotnet), PostgreSQL (infra/schema.sql), Terraform (infra/).

Corrija TODOS os 29 bugs abaixo. Para cada um, faça a edição no arquivo indicado. NÃO toque no terraform.tfstate. Crie um commit separado por grupo de severidade (críticos, altos, médios, baixos). Use mensagens de commit em português.

═══════════════════════════════════════════════
🔴 CRÍTICOS (5) — Crash, segurança, perda de dados
═══════════════════════════════════════════════

BUG #1 — Google Client IDs divergentes entre .env e .env.production
Arquivo: frontend-mobile/.env.production
O .env usa project 598286841038 (correto, alinha com google-services.json), mas .env.production usa 462336676738 (projeto diferente). Isso causa DEVELOPER_ERROR no Android em produção.
FIX: Substitua o conteúdo inteiro de frontend-mobile/.env.production por:
```
# EAS sem Git
EAS_NO_VCS=1

# URL base da API — AWS com HTTPS
EXPO_PUBLIC_API_URL=https://api.renovejasaude.com.br

# Login com Google (Web + Android + iOS)
# IMPORTANTE: Mesmos Client IDs do projeto Google Cloud 598286841038 (renoveja-be43f)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=598286841038-j095u3iopiqltpgbvu0f5od924etobk7.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=598286841038-780e9kksjoscthg0g611virnchlb7kcr.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=598286841038-28ili7c5stg5524sicropmm7s7nkq936.apps.googleusercontent.com

EXPO_PUBLIC_SENTRY_DSN=https://ac8dc5b18591d998f8a06f1a2a1b9495@o4511004670558208.ingest.us.sentry.io/4511052781912065
```

BUG #2 — signInWithGoogle aceita token nulo/vazio (loop de 401)
Arquivo: frontend-mobile/contexts/AuthContext.tsx
Na função signInWithGoogle, após a linha `if (!response?.user) throw new Error('Resposta inválida do servidor.');`, adicione:
```typescript
if (response.token == null || response.token === '') throw new Error('Servidor não retornou token de acesso. Tente novamente.');
```
E altere as linhas seguintes de:
```typescript
      await setItemSafe(AUTH_TOKEN_KEY, response.token ?? undefined);
      apiClient.setTokenCache(response.token ?? null);
```
Para:
```typescript
      await setItemSafe(AUTH_TOKEN_KEY, response.token);
      apiClient.setTokenCache(response.token);
```

BUG #3 — Schema SQL CHECK constraint não inclui role 'sus'
Arquivo: infra/schema.sql
Na tabela users, altere:
```sql
    role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'admin')),
```
Para:
```sql
    role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'admin', 'sus')),
```
Também crie o arquivo infra/migrations/20260317_add_sus_role.sql com:
```sql
-- Adiciona role 'sus' ao CHECK constraint da tabela users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('patient', 'doctor', 'admin', 'sus'));
```

BUG #4 — NotificationContext crasha quando PushNotificationContext não está montado
Arquivo: frontend-mobile/contexts/NotificationContext.tsx
Substitua a linha:
```typescript
import { usePushNotification } from './PushNotificationContext';
```
Por:
```typescript
// Import seguro: PushNotificationContext pode não estar montado (Expo Go, web)
function usePushNotificationSafe(): { lastNotificationAt: number } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./PushNotificationContext');
    if (mod?.usePushNotification) return mod.usePushNotification();
  } catch { /* provider não disponível */ }
  return { lastNotificationAt: 0 };
}
```
E dentro do NotificationProvider, substitua:
```typescript
  const { lastNotificationAt } = usePushNotification();
```
Por:
```typescript
  const { lastNotificationAt } = usePushNotificationSafe();
```

BUG #5 — getDocumentDownloadUrl expõe JWT completo na URL como fallback
Arquivo: frontend-mobile/lib/api-requests.ts
Na função getDocumentDownloadUrl, substitua o bloco catch:
```typescript
  } catch {
    // Fallback: se o endpoint de document-token não existir ainda, usa JWT (retrocompatibilidade)
    const token = await apiClient.getAuthToken();
    return `${baseUrl}/api/requests/${requestId}/document${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  }
```
Por:
```typescript
  } catch (err) {
    // SECURITY FIX: Não expor JWT completo na URL
    if (__DEV__) console.warn('[getDocumentDownloadUrl] document-token endpoint failed:', err);
    throw {
      message: 'Não foi possível gerar o link de download. Tente novamente em alguns instantes.',
      status: (err as { status?: number })?.status ?? 0,
    };
  }
```
Faça a MESMA correção na função getDocumentDownloadUrlById logo abaixo, substituindo o catch similar:
```typescript
  } catch {
    // Fallback: usa o endpoint de request (retrocompatibilidade)
    const token = await apiClient.getAuthToken();
    return `${baseUrl}/api/post-consultation/documents/${documentId}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  }
```
Por:
```typescript
  } catch (err) {
    // SECURITY FIX: Não expor JWT completo na URL
    if (__DEV__) console.warn('[getDocumentDownloadUrlById] document-token endpoint failed:', err);
    throw {
      message: 'Não foi possível gerar o link de download. Tente novamente em alguns instantes.',
      status: (err as { status?: number })?.status ?? 0,
    };
  }
```

═══════════════════════════════════════════════
🟠 ALTOS (4) — Funcionalidade quebrada
═══════════════════════════════════════════════

BUG #6 — useAudioRecorder usa console.warn em produção
Arquivo: frontend-mobile/hooks/useAudioRecorder.ts
Substitua (3 ocorrências):
```typescript
      console.warn('[AudioRecorder] Started recording, chunk interval:', CHUNK_DURATION_MS);
```
Por:
```typescript
      if (__DEV__) console.log('[AudioRecorder] Started recording, chunk interval:', CHUNK_DURATION_MS);
```
E:
```typescript
    console.warn('[AudioRecorder] Stopping...');
```
Por:
```typescript
    if (__DEV__) console.log('[AudioRecorder] Stopping...');
```
E:
```typescript
    console.warn('[AudioRecorder] Stopped.');
```
Por:
```typescript
    if (__DEV__) console.log('[AudioRecorder] Stopped.');
```

BUG #7 — SignalR reconecta com token potencialmente expirado
Arquivo: frontend-mobile/lib/requestsEvents.ts
Substitua:
```typescript
        accessTokenFactory: async () => (await getToken()) ?? '',
```
Por:
```typescript
        accessTokenFactory: async () => {
          const t = await getToken();
          if (!t) {
            if (__DEV__) console.warn('[RequestsEvents] Token ausente no reconnect');
            return '';
          }
          return t;
        },
```
Também após a linha `const conn = builder.build();`, adicione:
```typescript

    conn.onclose((error: Error | undefined) => {
      if (__DEV__) console.warn('[RequestsEvents] Conexão fechada:', error?.message);
      connection = null;
    });
```

BUG #8 — Polling de notificações pode causar setState após unmount
Arquivo: frontend-mobile/contexts/NotificationContext.tsx
No useEffect de polling (o terceiro useEffect, que começa com `if (!user?.id) return;`), adicione flag cancelled. Substitua o conteúdo inteiro desse useEffect por:
```typescript
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && !cancelled) {
        refreshUnreadCount();
        appState.current = nextState;
      } else {
        appState.current = nextState;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    let timerId: ReturnType<typeof setTimeout>;
    const schedulePoll = () => {
      const delay = unchangedPolls.current >= UNCHANGED_THRESHOLD ? POLL_INTERVAL_SLOW_MS : POLL_INTERVAL_MS;
      timerId = setTimeout(() => {
        if (cancelled) return;
        if (appState.current === 'active') {
          refreshUnreadCount();
        }
        schedulePoll();
      }, delay);
    };
    schedulePoll();

    return () => {
      cancelled = true;
      subscription.remove();
      clearTimeout(timerId);
    };
  }, [user?.id, refreshUnreadCount]);
```

BUG #9 — register.tsx variáveis redeclaradas no escopo interno (shadow)
Arquivo: frontend-mobile/app/(auth)/register.tsx
Dentro do handleRegister, no bloco try (após as validações), as variáveis str, num, neigh, ci, st são redeclaradas. Substitua este bloco:
```typescript
      const str = street.trim();
      const num = number.trim();
      const neigh = neighborhood.trim();
      const comp = complement.trim();
      const ci = city.trim();
      const st = state.trim().toUpperCase().slice(0, 2);
      const postalCode = onlyDigits(cep);
```
Por (removendo as redeclarações que já existem no escopo de validação acima):
```typescript
      const comp = complement.trim();
      const postalCode = onlyDigits(cep);
```

═══════════════════════════════════════════════
🟡 MÉDIOS (7) — UX ruim, comportamento inesperado
═══════════════════════════════════════════════

BUG #10 — Admin isAuthenticated() é client-side only
Arquivo: frontend-web/src/App.tsx
Substitua a função AdminProtectedRoute por:
```typescript
function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  // TODO(security): Adicionar verificação de token com backend (GET /api/auth/me)
  // para validar que o token é real e que o user tem role admin.
  // A verificação client-side atual pode ser bypassada facilmente.
  if (!isAuthenticated()) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}
```

BUG #11 — Timeout de splash agressivo (1.2s) conflita com SPLASH_MAX_MS (4s)
Arquivo: frontend-mobile/contexts/AuthContext.tsx
Altere o timeout de 1200 para 3000:
```typescript
    }, 1200);
```
Para:
```typescript
    }, 3000);
```
E altere o guard de 1500 para 3500:
```typescript
    const guard = setTimeout(() => setLoading(false), 1500);
```
Para:
```typescript
    const guard = setTimeout(() => setLoading(false), 3500);
```

BUG #12 — isDoctorPortal() /login conflita com rotas públicas
Arquivo: frontend-web/src/App.tsx
Na lista doctorPaths dentro de isDoctorPortal(), remova '/login' e adicione comentário:
```typescript
    const doctorPaths = [
      // '/login' removido: conflita com rotas públicas no mesmo host
      '/registro',
```

BUG #13 — Sentry DSN ausente no .env.production
Já corrigido no BUG #1.

BUG #14 — .env.local pode estar tracked no git
Execute no terminal:
```bash
git rm --cached frontend-web/.env.local 2>/dev/null || true
git rm --cached frontend-web/.env 2>/dev/null || true
```

BUG #15 — fetchDoctorStats engole erros silenciosamente em produção
Arquivo: frontend-mobile/lib/api-doctors.ts
Substitua:
```typescript
    if (__DEV__) logApiError(0, '/api/requests/stats', (e as { message?: string })?.message ?? String(e));
```
Por (remove o guard __DEV__ para logar em produção também):
```typescript
    logApiError(0, '/api/requests/stats', (e as { message?: string })?.message ?? String(e));
```

BUG #16 — requestsEvents.ts console.warn sem __DEV__ guard
Arquivo: frontend-mobile/lib/requestsEvents.ts
Substitua:
```typescript
          console.warn('[RequestsEvents] Listener error:', e);
```
Por:
```typescript
          if (__DEV__) console.warn('[RequestsEvents] Listener error:', e);
```

═══════════════════════════════════════════════
🔵 BAIXOS (13) — Code smells e melhorias
═══════════════════════════════════════════════

BUG #17 — Schema: outbox_events sem index em status
Arquivo: infra/schema.sql
Após a linha com `ux_outbox_events_idempotency_key`, adicione:
```sql
CREATE INDEX IF NOT EXISTS idx_outbox_events_status ON public.outbox_events(status) WHERE status = 'pending';
```
Também crie infra/migrations/20260317_outbox_status_index.sql:
```sql
CREATE INDEX IF NOT EXISTS idx_outbox_events_status ON public.outbox_events(status) WHERE status = 'pending';
```

BUG #18 — Schema: sem trigger updated_at automático
Arquivo: infra/schema.sql
Antes da linha `-- Fim do schema RenoveJá+`, adicione:
```sql

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_users') THEN
    CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_requests') THEN
    CREATE TRIGGER set_updated_at_requests BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_care_plans') THEN
    CREATE TRIGGER set_updated_at_care_plans BEFORE UPDATE ON public.care_plans FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_care_plan_tasks') THEN
    CREATE TRIGGER set_updated_at_care_plan_tasks BEFORE UPDATE ON public.care_plan_tasks FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
  END IF;
END $$;
```
Crie também infra/migrations/20260317_updated_at_triggers.sql com o mesmo conteúdo.

BUG #19 — signUpDoctor usa ?? undefined redundantemente
Arquivo: frontend-mobile/contexts/AuthContext.tsx
No signUpDoctor, substitua todas as 11 linhas `?? undefined` por `|| undefined`:
```typescript
        professionalPhone: data.professionalPhone || undefined,
        professionalPostalCode: data.professionalPostalCode || undefined,
        professionalStreet: data.professionalStreet || undefined,
        professionalNumber: data.professionalNumber || undefined,
        professionalNeighborhood: data.professionalNeighborhood || undefined,
        professionalComplement: data.professionalComplement || undefined,
        professionalCity: data.professionalCity || undefined,
        professionalState: data.professionalState || undefined,
        university: data.university || undefined,
        courses: data.courses || undefined,
        hospitalsServices: data.hospitalsServices || undefined,
```

BUG #20 — useDailyJoin não limpa event listeners no leave
Arquivo: frontend-mobile/hooks/useDailyJoin.ts
Na função leave, antes da linha `await call.leave();`, adicione:
```typescript
      call.off('joined-meeting' as DailyEvent);
      call.off('participant-joined' as DailyEvent);
      call.off('participant-updated' as DailyEvent);
      call.off('participant-left' as DailyEvent);
      call.off('meeting-ended' as DailyEvent);
      call.off('left-meeting' as DailyEvent);
      call.off('error' as DailyEvent);
```
Precisa importar DailyEvent no topo se já não está importado (está: `DailyEvent` já está no import).

BUG #21 — Versões React/TS incompatíveis (apenas documentar)
Arquivo: README.md (raiz do projeto)
No final do arquivo, adicione:
```markdown

## ⚠️ Notas técnicas

- **React version mismatch**: frontend-mobile usa React 19.1.0, frontend-web usa React 18.3.1. Unificar quando possível.
- **TypeScript version mismatch**: frontend-mobile usa TS ~5.9.2, frontend-web usa TS ~5.6.2.
- **Zod v4**: Ambos os projetos usam zod ^4.3.6 (recente). Monitorar breaking changes.
```

BUG #22 — .env.local pode estar tracked (já coberto no BUG #14)

BUG #23 — consultation_time_bank_transactions sem index para queries por reason
Arquivo: infra/schema.sql
Após o index idx_ctb_transactions_bank_id, adicione:
```sql
CREATE INDEX IF NOT EXISTS idx_ctb_transactions_reason ON public.consultation_time_bank_transactions(reason);
```

BUG #24 — password_hash sem constraint de tamanho mínimo
Arquivo: infra/schema.sql
Substitua:
```sql
    password_hash TEXT NOT NULL,
```
Por:
```sql
    password_hash TEXT NOT NULL CHECK (length(password_hash) >= 20),
```
Crie infra/migrations/20260317_password_hash_check.sql:
```sql
-- Garante hash mínimo de 20 chars (BCrypt = 60 chars)
ALTER TABLE public.users ADD CONSTRAINT chk_password_hash_min_length CHECK (length(password_hash) >= 20);
```

BUG #25 — doctor_certificates.pfx_storage_path guarda path absoluto
Arquivo: infra/schema.sql
Adicione comentário na coluna. Substitua:
```sql
    pfx_storage_path TEXT NOT NULL,
```
Por:
```sql
    pfx_storage_path TEXT NOT NULL, -- Usar apenas key relativa (sem bucket). Ex: doctors/{uuid}/cert.pfx
```

BUG #26 — api-client.ts getDefaultBaseUrl sem warning para device físico
Arquivo: frontend-mobile/lib/api-client.ts
Substitua:
```typescript
const getDefaultBaseUrl = () => {
  if (Platform.OS === 'web') return '';
  if (Platform.OS === 'android') return 'http://10.0.2.2:5000';
  return 'http://localhost:5000';
};
```
Por:
```typescript
const getDefaultBaseUrl = () => {
  if (Platform.OS === 'web') return '';
  if (Platform.OS === 'android') {
    // ⚠️ 10.0.2.2 só funciona no EMULADOR. Para device físico, defina EXPO_PUBLIC_API_URL no .env
    if (__DEV__) console.log('[ApiClient] Usando 10.0.2.2:5000 (emulador). Para device físico, defina EXPO_PUBLIC_API_URL.');
    return 'http://10.0.2.2:5000';
  }
  return 'http://localhost:5000';
};
```

BUG #27 — signUpDoctor setar token com ?? null quando requiresApproval é false
Arquivo: frontend-mobile/contexts/AuthContext.tsx
No bloco `if (!requiresApproval)` do signUpDoctor, substitua:
```typescript
        await setItemSafe(AUTH_TOKEN_KEY, response.token ?? undefined);
        apiClient.setTokenCache(response.token ?? null);
```
Por:
```typescript
        await setItemSafe(AUTH_TOKEN_KEY, response.token);
        apiClient.setTokenCache(response.token);
```

BUG #28 — terraform.tfstate pode estar tracked apesar do .gitignore
Execute:
```bash
git rm --cached infra/terraform.tfstate 2>/dev/null || true
```

BUG #29 — outbox_events.processed_at sem index para cleanup
Arquivo: infra/schema.sql
Após o index de outbox_events_status, adicione:
```sql
CREATE INDEX IF NOT EXISTS idx_outbox_events_processed_at ON public.outbox_events(processed_at) WHERE processed_at IS NOT NULL;
```

═══════════════════════════════════════════════
INSTRUÇÕES FINAIS
═══════════════════════════════════════════════

1. Leia cada arquivo com cat/Read ANTES de editar para confirmar o conteúdo atual
2. Faça as edições arquivo por arquivo usando sed, patch ou edit tools
3. Após cada grupo, crie um commit:
   - git add -A && git commit -m "fix(critical): corrige Google OAuth, token nulo, role SUS, NotificationContext crash, JWT exposto na URL"
   - git add -A && git commit -m "fix(high): corrige logs produção, SignalR reconnect, polling cleanup, variáveis redeclaradas"
   - git add -A && git commit -m "fix(medium): admin auth TODO, splash timeout, isDoctorPortal, stats logging, requestsEvents guard"
   - git add -A && git commit -m "fix(low): schema indexes, triggers, code smells, Daily listeners, .gitignore cleanup"
4. NÃO toque no terraform.tfstate diretamente (apenas git rm --cached)
5. Para os git rm --cached, não delete os arquivos do disco