/**
 * DoctorSettings — Configurações do portal do médico.
 * Inclui: Dra. Renova, aparência, preferências de push por categoria, links.
 */
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/hooks/useTheme';
import {
  Moon, Sun, Monitor, HelpCircle, FileText, Shield, Info,
  MessageCircle, Bell, Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getMutedKeys, unmuteAll } from '@/lib/triagePersistence';
import {
  getPushPreferences, updatePushPreferences,
  type PushPreferencesDto,
} from '@/services/doctorApi';
import { toast } from 'sonner';

function ToggleRow({
  label, description, checked, onChange, disabled,
}: {
  label: string; description?: string; checked: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`} />
      </button>
    </div>
  );
}

export default function DoctorSettings() {
  const { theme, setTheme } = useTheme();
  const [mutedCount, setMutedCount] = useState(0);
  const [pushPrefs, setPushPrefs] = useState<PushPreferencesDto>({
    requestsEnabled: true,
    paymentsEnabled: true,
    consultationsEnabled: true,
    remindersEnabled: true,
    timezone: 'America/Sao_Paulo',
  });
  const [pushLoading, setPushLoading] = useState(true);
  const [pushSaving, setPushSaving] = useState(false);

  useEffect(() => {
    getMutedKeys().then((keys) => setMutedCount(keys.length)).catch(() => {});
    getPushPreferences()
      .then(setPushPrefs)
      .catch(() => {})
      .finally(() => setPushLoading(false));
  }, []);

  const handleUnmuteAll = async () => {
    await unmuteAll();
    setMutedCount(0);
  };

  const handlePushToggle = async (key: keyof PushPreferencesDto, value: boolean) => {
    const prev = { ...pushPrefs };
    const updated = { ...pushPrefs, [key]: value };
    setPushPrefs(updated);
    setPushSaving(true);
    try {
      await updatePushPreferences({ [key]: value });
    } catch {
      setPushPrefs(prev);
      toast.error('Erro ao salvar preferência');
    } finally {
      setPushSaving(false);
    }
  };

  return (
    <DoctorLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>

        {/* Dra. Renova */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" aria-hidden />
              Assistente Dra. Renova
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Reativar mensagens silenciadas ({mutedCount})</span>
              {mutedCount > 0 ? (
                <Button variant="outline" size="sm" onClick={handleUnmuteAll}>Reativar</Button>
              ) : (
                <span className="text-sm text-muted-foreground">Nenhuma</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Push Preferences */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" aria-hidden />
              Notificações por categoria
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {pushLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                <ToggleRow
                  label="Pedidos"
                  description="Novos pedidos, aprovações e atualizações"
                  checked={pushPrefs.requestsEnabled}
                  onChange={(v) => handlePushToggle('requestsEnabled', v)}
                  disabled={pushSaving}
                />
                <ToggleRow
                  label="Consultas"
                  description="Agendamentos e videochamadas"
                  checked={pushPrefs.consultationsEnabled}
                  onChange={(v) => handlePushToggle('consultationsEnabled', v)}
                  disabled={pushSaving}
                />
                <ToggleRow
                  label="Lembretes"
                  description="Lembretes de tarefas e prazos"
                  checked={pushPrefs.remindersEnabled}
                  onChange={(v) => handlePushToggle('remindersEnabled', v)}
                  disabled={pushSaving}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aparência */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sun className="h-4 w-4 text-primary" aria-hidden />
              Aparência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Modo escuro</Label>
              <div className="flex gap-2">
                <Button variant={theme === 'light' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('light')} className="gap-1.5">
                  <Sun className="h-3.5 w-3.5" /> Claro
                </Button>
                <Button variant={theme === 'dark' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('dark')} className="gap-1.5">
                  <Moon className="h-3.5 w-3.5" /> Escuro
                </Button>
                <Button variant={theme === 'system' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('system')} className="gap-1.5">
                  <Monitor className="h-3.5 w-3.5" /> Sistema
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informações */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" aria-hidden />
              Informações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/sobre"><Button variant="ghost" className="w-full justify-start gap-2" asChild><span><Info className="h-4 w-4" /> Sobre o RenoveJá+</span></Button></Link>
            <Link to="/ajuda"><Button variant="ghost" className="w-full justify-start gap-2" asChild><span><HelpCircle className="h-4 w-4" /> Ajuda e FAQ</span></Button></Link>
            <Link to="/termos"><Button variant="ghost" className="w-full justify-start gap-2" asChild><span><FileText className="h-4 w-4" /> Termos de Uso</span></Button></Link>
            <Link to="/privacidade"><Button variant="ghost" className="w-full justify-start gap-2" asChild><span><Shield className="h-4 w-4" /> Política de Privacidade</span></Button></Link>
          </CardContent>
        </Card>
      </div>
    </DoctorLayout>
  );
}
