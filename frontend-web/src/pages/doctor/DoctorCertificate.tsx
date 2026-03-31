/**
 * DoctorCertificate — Tela dedicada de gerenciamento de certificado digital.
 * Alinhada ao mobile certificate/upload.tsx.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  getActiveCertificate, uploadCertificate, revokeCertificate,
  type CertificateInfo,
} from '@/services/doctorApi';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Loader2, Shield, ShieldCheck, ShieldAlert, Upload, FileUp,
  Trash2, Calendar, ArrowLeft, CheckCircle2, AlertTriangle, Lock,
} from 'lucide-react';

export default function DoctorCertificate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [certInfo, setCertInfo] = useState<CertificateInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeLoading, setRevokeLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Certificado Digital — RenoveJá+';
    return () => { document.title = 'RenoveJá+'; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCert().finally(() => { if (cancelled) { /* component unmounted */ } });
    return () => { cancelled = true; };
  }, []);

  const loadCert = async () => {
    setLoading(true);
    try {
      const cert = await getActiveCertificate();
      setCertInfo(cert);
    } catch {
      setCertInfo(null);
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

  const handleUpload = async () => {
    if (!selectedFile || !certPassword) {
      toast.error('Selecione o arquivo e informe a senha');
      return;
    }
    setUploading(true);
    try {
      await uploadCertificate(selectedFile, certPassword);
      toast.success('Certificado enviado com sucesso!');
      setSelectedFile(null);
      setCertPassword('');
      await loadCert();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar certificado');
    } finally {
      setUploading(false);
    }
  };

  const handleRevoke = async () => {
    if (!certInfo) return;
    setRevokeLoading(true);
    try {
      await revokeCertificate(certInfo.id, revokeReason || 'Revogado pelo médico');
      toast.success('Certificado revogado');
      setRevokeDialogOpen(false);
      setRevokeReason('');
      await loadCert();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao revogar');
    } finally {
      setRevokeLoading(false);
    }
  };

  const daysUntilExpiry = certInfo?.daysUntilExpiry ?? 0;
  const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 30;

  if (loading) {
    return (
      <DoctorLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Certificado digital</h1>
            <p className="text-sm text-muted-foreground">ICP-Brasil A1 para assinatura de documentos</p>
          </div>
        </div>

        {/* Status atual */}
        {certInfo ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={`shadow-sm ${certInfo.isExpired ? 'border-destructive/50' : isExpiringSoon ? 'border-amber-300 dark:border-amber-700' : 'border-emerald-300 dark:border-emerald-700'}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {certInfo.isExpired ? (
                    <ShieldAlert className="h-5 w-5 text-destructive" />
                  ) : isExpiringSoon ? (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  )}
                  Certificado {certInfo.isExpired ? 'expirado' : certInfo.isValid ? 'ativo' : 'inválido'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Titular</p>
                    <p className="font-medium">{certInfo.subjectName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Emissor</p>
                    <p className="font-medium">{certInfo.issuerName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Válido desde</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      {new Date(certInfo.notBefore).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Expira em</p>
                    <p className={`font-medium flex items-center gap-1.5 ${certInfo.isExpired ? 'text-destructive' : isExpiringSoon ? 'text-amber-600' : ''}`}>
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(certInfo.notAfter).toLocaleDateString('pt-BR')}
                      {!certInfo.isExpired && ` (${daysUntilExpiry}d)`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => setRevokeDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Revogar certificado
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : null}

        {/* Upload form */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              {certInfo ? 'Substituir certificado' : 'Enviar certificado'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Envie seu certificado digital ICP-Brasil A1 (arquivo .PFX ou .P12) para
              habilitar a assinatura eletrônica de receitas e pedidos de exame.
            </p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="cert-file">Arquivo do certificado</Label>
                <div className="mt-1.5">
                  <input
                    ref={fileInputRef}
                    id="cert-file"
                    type="file"
                    accept=".pfx,.p12"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileUp className="h-4 w-4" />
                    {selectedFile ? selectedFile.name : 'Selecionar arquivo .PFX / .P12'}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="cert-pw">Senha do certificado</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="cert-pw"
                    type="password"
                    value={certPassword}
                    onChange={(e) => setCertPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    autoComplete="off"
                  />
                </div>
              </div>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || !certPassword || uploading}
                className="w-full gap-2"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {uploading ? 'Enviando...' : 'Enviar certificado'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info card */}
        <Card className="shadow-sm border-blue-100 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Sobre o certificado digital</p>
                <p>O certificado ICP-Brasil A1 é necessário para assinar digitalmente receitas e pedidos de exame, conforme exigido pela legislação brasileira.</p>
                <p>Você pode obter seu certificado através de autoridades certificadoras como Serpro, Certisign ou Soluti.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revoke dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Revogar certificado
            </DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Você precisará enviar um novo certificado para continuar assinando documentos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="revoke-reason">Motivo (opcional)</Label>
            <Textarea
              id="revoke-reason"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Ex: Certificado comprometido, troca de certificado..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revokeLoading} className="gap-2">
              {revokeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Confirmar revogação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DoctorLayout>
  );
}
