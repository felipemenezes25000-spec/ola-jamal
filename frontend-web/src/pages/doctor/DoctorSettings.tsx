/**
 * DoctorSettings — Configurações do portal do médico.
 * Alinhado ao mobile settings: aparência, links utilitários.
 */
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/hooks/useTheme';
import { Moon, Sun, Monitor, HelpCircle, FileText, Shield, Info, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getMutedKeys, unmuteAll } from '@/lib/triagePersistence';

export default function DoctorSettings() {
  const { theme, setTheme } = useTheme();
  const [mutedCount, setMutedCount] = useState(0);

  useEffect(() => {
    getMutedKeys().then((keys) => setMutedCount(keys.length)).catch(() => {});
  }, []);

  const handleUnmuteAll = async () => {
    await unmuteAll();
    setMutedCount(0);
  };

  return (
    <DoctorLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" aria-hidden />
              Assistente Dra. Renoveja
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Reativar mensagens silenciadas ({mutedCount})</span>
              {mutedCount > 0 ? (
                <Button variant="outline" size="sm" onClick={handleUnmuteAll}>
                  Reativar
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground">Nenhuma</span>
              )}
            </div>
          </CardContent>
        </Card>

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
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('light')}
                  className="gap-1.5"
                >
                  <Sun className="h-3.5 w-3.5" />
                  Claro
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('dark')}
                  className="gap-1.5"
                >
                  <Moon className="h-3.5 w-3.5" />
                  Escuro
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('system')}
                  className="gap-1.5"
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Sistema
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" aria-hidden />
              Informações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/sobre">
              <Button variant="ghost" className="w-full justify-start gap-2" asChild>
                <span>
                  <Info className="h-4 w-4" />
                  Sobre o RenoveJá+
                </span>
              </Button>
            </Link>
            <Link to="/ajuda">
              <Button variant="ghost" className="w-full justify-start gap-2" asChild>
                <span>
                  <HelpCircle className="h-4 w-4" />
                  Ajuda e FAQ
                </span>
              </Button>
            </Link>
            <Link to="/termos">
              <Button variant="ghost" className="w-full justify-start gap-2" asChild>
                <span>
                  <FileText className="h-4 w-4" />
                  Termos de Uso
                </span>
              </Button>
            </Link>
            <Link to="/privacidade">
              <Button variant="ghost" className="w-full justify-start gap-2" asChild>
                <span>
                  <Shield className="h-4 w-4" />
                  Política de Privacidade
                </span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </DoctorLayout>
  );
}
