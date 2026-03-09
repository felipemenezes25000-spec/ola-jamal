import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useDoctorAuth } from '@/contexts/DoctorAuthContext';
import { getActiveCertificate, uploadCertificate } from '@/services/doctorApi';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Upload, FileText, LogOut } from 'lucide-react';

const TERMS_URL = 'https://renovejasaude.com.br/cookies';
const PRIVACY_EMAIL = 'mailto:privacidade@renovejasaude.com.br';

/**
 * Tela obrigatória para médicos concluírem o cadastro com certificado digital.
 * Exibida após registro ou login quando profileComplete === false.
 */
export default function DoctorCompleteDoctor() {
  const navigate = useNavigate();
  const { refreshUser, signOut, isAuthenticated, loading: authLoading } = useDoctorAuth();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCert();
  }, []);

  const loadCert = async () => {
    try {
      const cert = await getActiveCertificate();
      if (cert) {
        await refreshUser();
        navigate('/dashboard', { replace: true });
        return;
      }
    } catch {
      // no cert yet
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext !== 'pfx' && ext !== 'p12') {
        toast.error('Selecione um arquivo .PFX ou .P12');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Selecione o arquivo PFX');
      return;
    }
    if (!password) {
      toast.error('Informe a senha do certificado');
      return;
    }
    if (!acceptedTerms || !acceptedPrivacy) {
      toast.error('Aceite os Termos de Uso e a Política de Privacidade para continuar.');
      return;
    }
    setUploading(true);
    try {
      await uploadCertificate(selectedFile, password);
      await refreshUser();
      toast.success('Certificado cadastrado com sucesso!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer upload do certificado');
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = () => {
    if (window.confirm('Deseja sair? Você poderá concluir o cadastro do certificado no próximo acesso.')) {
      signOut();
      navigate('/login', { replace: true });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 font-medium transition-colors"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sair
          </button>
          <h1 className="text-lg font-semibold text-foreground">Completar cadastro</h1>
          <div className="w-16" aria-hidden />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6 pb-6 flex flex-col items-center text-center">
            <ShieldCheck className="h-10 w-10 text-primary mb-3" aria-hidden />
            <h2 className="text-lg font-semibold text-foreground mb-2">Certificado digital obrigatório</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Para concluir seu cadastro, cadastre seu certificado digital. Ele é necessário para
              assinar receitas e pedidos de exame.
            </p>
            <p className="text-sm text-muted-foreground max-w-md mt-2">
              A senha do certificado não é armazenada: ela é usada apenas no momento da assinatura e não fica salva em nossos servidores.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-base font-semibold text-foreground mb-3">Uso de IA, Certificado e Documentos</h3>
            <p className="text-sm text-muted-foreground mb-4">
              A plataforma utiliza IA no atendimento (triagem e leitura de receitas e exames). A senha do certificado não é armazenada — é usada apenas no momento da assinatura.
            </p>
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  aria-describedby="terms-desc"
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span id="terms-desc" className="text-sm text-foreground group-hover:text-foreground/90">
                  Li e aceito os Termos de Uso.
                </span>
              </label>
              <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-primary font-medium hover:underline block">
                Ler Termos de Uso
              </a>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                  aria-describedby="privacy-desc"
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span id="privacy-desc" className="text-sm text-foreground group-hover:text-foreground/90">
                  Li e aceito a Política de Privacidade.
                </span>
              </label>
              <a href={PRIVACY_EMAIL} className="text-sm text-primary font-medium hover:underline block">
                Ler Política de Privacidade
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Upload do Certificado</h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pfx,.p12,application/x-pkcs12,application/octet-stream"
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="Selecionar arquivo PFX"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors"
                >
                  <Upload className="h-8 w-8 text-primary" aria-hidden />
                  <span className="text-sm font-medium text-primary">
                    {selectedFile ? selectedFile.name : 'Selecionar arquivo .PFX'}
                  </span>
                  {selectedFile && (
                    <span className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(0)} KB
                    </span>
                  )}
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cert-password">Senha do Certificado</Label>
                <Input
                  id="cert-password"
                  type="password"
                  placeholder="Digite a senha do PFX (não é armazenada)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <Button type="submit" className="w-full h-11" disabled={uploading}>
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" aria-hidden />
                )}
                Enviar e concluir cadastro
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-base font-semibold text-foreground mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" aria-hidden />
              Como obter um certificado?
            </h3>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Adquira um e-CPF A1 em uma Autoridade Certificadora (AC).</li>
              <li>Faça o download do arquivo .PFX (PKCS#12).</li>
              <li>Faça o upload aqui com a senha definida na emissão.</li>
            </ol>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
