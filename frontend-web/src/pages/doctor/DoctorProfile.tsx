import { useState, useEffect } from 'react';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useDoctorAuth } from '@/hooks/useDoctorAuth';
import { Textarea } from '@/components/ui/textarea';
import {
  updateAvatar, updateDoctorProfile, changePassword,
  getActiveCertificate, uploadCertificate, revokeCertificate,
  type CertificateInfo,
} from '@/services/doctorApi';
import { toast } from 'sonner';
import {
  Loader2, Mail, Phone, Shield, Upload, Camera,
  Lock, Save, Stethoscope, MapPin, AlertTriangle, FileUp, Trash2, Calendar, User as UserIcon,
  ChevronRight, HelpCircle, FileText, Bell, LogOut,
} from 'lucide-react';

export default function DoctorProfile() {
  const { user, doctorProfile, refreshUser } = useDoctorAuth();

  useEffect(() => {
    document.title = 'Perfil — RenoveJa+';
    return () => { document.title = 'RenoveJa+'; };
  }, []);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [certInfo, setCertInfo] = useState<CertificateInfo | null>(null);
  const [certLoaded, setCertLoaded] = useState(false);

  const [profPhone, setProfPhone] = useState(doctorProfile?.professionalPhone || '');
  const [profAddress, setProfAddress] = useState(doctorProfile?.professionalAddress || '');

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');
  const [certLoading, setCertLoading] = useState(false);

  const [revokeReason, setRevokeReason] = useState('');
  const [revokeLoading, setRevokeLoading] = useState(false);

  // Edit profile section
  const [editOpen, setEditOpen] = useState(false);

  const hasCert = !!certInfo;

  useEffect(() => {
    let cancelled = false;
    getActiveCertificate()
      .then(data => { if (!cancelled) setCertInfo(data); })
      .catch(() => { if (!cancelled) setCertInfo(null); })
      .finally(() => { if (!cancelled) setCertLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (doctorProfile) {
      setProfPhone(doctorProfile.professionalPhone || '');
      setProfAddress(doctorProfile.professionalAddress || '');
    }
  }, [doctorProfile]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    try {
      await updateAvatar(file);
      await refreshUser();
      toast.success('Avatar atualizado');
    } catch {
      toast.error('Erro ao atualizar avatar');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateDoctorProfile({ professionalPhone: profPhone, professionalAddress: profAddress });
      await refreshUser();
      toast.success('Perfil atualizado');
      setEditOpen(false);
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPw !== newPwConfirm) {
      toast.error('Senhas nao coincidem');
      return;
    }
    if (newPw.length < 8) {
      toast.error('A nova senha deve ter pelo menos 8 caracteres');
      return;
    }
    setPwLoading(true);
    try {
      await changePassword(currentPw, newPw);
      toast.success('Senha alterada');
      setPasswordDialogOpen(false);
      setCurrentPw(''); setNewPw(''); setNewPwConfirm('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar senha');
    } finally {
      setPwLoading(false);
    }
  };

  const handleUploadCert = async () => {
    if (!certFile || !certPassword) return;
    setCertLoading(true);
    try {
      await uploadCertificate(certFile, certPassword);
      const fresh = await getActiveCertificate();
      setCertInfo(fresh);
      toast.success('Certificado enviado');
      setCertDialogOpen(false);
      setCertFile(null); setCertPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar certificado');
    } finally {
      setCertLoading(false);
    }
  };

  const handleRevokeCert = async () => {
    if (!certInfo || !revokeReason.trim()) return;
    setRevokeLoading(true);
    try {
      await revokeCertificate(certInfo.id, revokeReason.trim());
      setCertInfo(null);
      toast.success('Certificado revogado');
      setRevokeDialogOpen(false);
      setRevokeReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao revogar certificado');
    } finally {
      setRevokeLoading(false);
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'MD';

  return (
    <DoctorLayout>
      <div className="min-h-screen bg-gray-50/50">
        {/* ── Gradient Header ── */}
        <div
          className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0C4A6E 0%, #075985 50%, #0369A1 100%)',
            borderBottomLeftRadius: '1.5rem',
            borderBottomRightRadius: '1.5rem',
          }}
        >
          <div className="max-w-xl mx-auto px-4 sm:px-6 pt-8 pb-20 text-center">
            <h1 className="text-white text-lg font-semibold tracking-tight">Meu Perfil</h1>
          </div>
        </div>

        {/* ── Avatar + Info Card (overlapping header) ── */}
        <div className="max-w-xl mx-auto px-4 sm:px-6 -mt-14">
          <div className="flex flex-col items-center">
            {/* Avatar */}
            <div className="relative group mb-3">
              <div className="w-[88px] h-[88px] rounded-full bg-gradient-to-br from-sky-200 to-sky-100 flex items-center justify-center ring-4 ring-white shadow-lg relative overflow-hidden">
                <span className="text-2xl font-bold text-sky-700">{initials}</span>
                {user?.avatarUrl && (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="absolute inset-0 w-full h-full rounded-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
              </div>
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                {avatarLoading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="sr-only" />
              </label>
            </div>

            {/* Name + Email */}
            <h2 className="text-xl font-bold text-gray-900">{user?.name}</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
              <Mail className="h-3.5 w-3.5" /> {user?.email}
            </p>

            {/* CRM / Specialty card */}
            {doctorProfile && (
              <div className="mt-3 bg-white rounded-xl shadow-sm border px-4 py-2.5 flex items-center gap-3">
                <Stethoscope className="h-4 w-4 text-sky-600 shrink-0" />
                <span className="text-sm font-medium text-gray-700">
                  CRM {doctorProfile.crm}/{doctorProfile.crmState}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">{doctorProfile.specialty}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Menu Sections ── */}
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-5">

          {/* PROFISSIONAL */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Profissional
            </p>
            <Card className="shadow-sm border-0 ring-1 ring-gray-200 divide-y divide-gray-100 overflow-hidden">
              {/* Edit profile */}
              <button
                onClick={() => setEditOpen(!editOpen)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                  <MapPin className="h-4.5 w-4.5 text-sky-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Dados Profissionais</p>
                  <p className="text-xs text-muted-foreground truncate">Telefone e endereco</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>

              {/* Inline edit form */}
              {editOpen && (
                <div className="px-4 py-4 space-y-3 bg-gray-50/50">
                  <div className="space-y-2">
                    <Label htmlFor="prof-phone">Telefone profissional</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                      <Input id="prof-phone" value={profPhone} onChange={e => setProfPhone(e.target.value)} placeholder="(11) 3333-4444" className="pl-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prof-address">Endereco profissional</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                      <Input id="prof-address" value={profAddress} onChange={e => setProfAddress(e.target.value)} placeholder="Rua, numero, bairro..." className="pl-10" />
                    </div>
                  </div>
                  <Button onClick={handleSaveProfile} disabled={saving} size="sm" className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar alteracoes
                  </Button>
                </div>
              )}

              {/* Certificate */}
              <button
                onClick={() => hasCert ? undefined : setCertDialogOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${hasCert ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                  <Shield className={`h-4.5 w-4.5 ${hasCert ? 'text-emerald-600' : 'text-amber-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Certificado Digital</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {!certLoaded ? 'Carregando...' : hasCert ? `Expira em ${certInfo.daysUntilExpiry} dias` : 'Pendente — envie seu .pfx'}
                  </p>
                </div>
                {hasCert ? (
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    certInfo.daysUntilExpiry > 60 ? 'bg-emerald-100 text-emerald-700' :
                    certInfo.daysUntilExpiry > 30 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {certInfo.daysUntilExpiry}d
                  </div>
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Certificate details (if has cert) */}
              {hasCert && certLoaded && (
                <div className="px-4 py-3 bg-gray-50/50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-start gap-2.5">
                      <UserIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Titular</p>
                        <p className="text-sm font-medium truncate">{certInfo.subjectName}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Validade</p>
                        <p className="text-sm font-medium">
                          {new Date(certInfo.notBefore).toLocaleDateString('pt-BR')} — {new Date(certInfo.notAfter).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3">
                    <Button variant="outline" size="sm" onClick={() => setCertDialogOpen(true)} className="gap-1.5 text-xs">
                      <FileUp className="h-3.5 w-3.5" />
                      Atualizar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setRevokeDialogOpen(true)} className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/5">
                      <Trash2 className="h-3.5 w-3.5" />
                      Revogar
                    </Button>
                  </div>
                </div>
              )}

              {/* No cert warning */}
              {!hasCert && certLoaded && (
                <div className="px-4 py-3 bg-amber-50/50 flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700 flex-1">Envie seu certificado A1 (.pfx) para assinar documentos</p>
                  <Button size="sm" variant="outline" onClick={() => setCertDialogOpen(true)} className="gap-1.5 text-xs shrink-0">
                    <FileUp className="h-3.5 w-3.5" />
                    Enviar
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* CONTA */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Conta
            </p>
            <Card className="shadow-sm border-0 ring-1 ring-gray-200 divide-y divide-gray-100 overflow-hidden">
              <button
                onClick={() => setPasswordDialogOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                  <Lock className="h-4.5 w-4.5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Alterar senha</p>
                  <p className="text-xs text-muted-foreground">Atualize sua senha de acesso</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>

              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Bell className="h-4.5 w-4.5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Notificacoes</p>
                  <p className="text-xs text-muted-foreground">Preferencias de aviso</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </Card>
          </div>

          {/* SUPORTE */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Suporte
            </p>
            <Card className="shadow-sm border-0 ring-1 ring-gray-200 divide-y divide-gray-100 overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <HelpCircle className="h-4.5 w-4.5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Central de ajuda</p>
                  <p className="text-xs text-muted-foreground">FAQ e tutoriais</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>

              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <FileText className="h-4.5 w-4.5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Termos e privacidade</p>
                  <p className="text-xs text-muted-foreground">Documentos legais</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </Card>
          </div>

          {/* LOGOUT */}
          <Button
            variant="ghost"
            className="w-full h-12 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 gap-2 rounded-xl transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </Button>

          {/* Version */}
          <p className="text-center text-xs text-muted-foreground pb-6">
            RenoveJa+ v1.0.0
          </p>
        </div>
      </div>

      {/* Password dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>Digite sua senha atual e a nova senha</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Senha atual</Label>
              <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" minLength={8} />
            </div>
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input type="password" value={newPwConfirm} onChange={e => setNewPwConfirm(e.target.value)} autoComplete="new-password" />
              {newPwConfirm && newPw !== newPwConfirm && <p className="text-xs text-destructive">Senhas nao coincidem</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPasswordDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleChangePassword} disabled={pwLoading || !currentPw || !newPw || newPw !== newPwConfirm}>
              {pwLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Alterar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certificate dialog */}
      <Dialog open={certDialogOpen} onOpenChange={setCertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Certificado Digital
            </DialogTitle>
            <DialogDescription>Envie seu certificado A1 (.pfx) e digite a senha</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Arquivo do certificado (.pfx)</Label>
              <Input
                type="file"
                accept=".pfx,.p12"
                onChange={e => setCertFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Senha do certificado</Label>
              <Input type="password" value={certPassword} onChange={e => setCertPassword(e.target.value)} placeholder="••••••••" autoComplete="off" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCertDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUploadCert} disabled={certLoading || !certFile || !certPassword} className="gap-2">
              {certLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Enviar certificado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke certificate dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Revogar Certificado
            </DialogTitle>
            <DialogDescription>
              Esta acao e irreversivel. O certificado sera revogado e voce precisara enviar um novo para assinar documentos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo da revogacao</Label>
            <Textarea
              value={revokeReason}
              onChange={e => setRevokeReason(e.target.value)}
              placeholder="Ex: Certificado comprometido, troca de certificado..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRevokeDialogOpen(false); setRevokeReason(''); }}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRevokeCert} disabled={revokeLoading || !revokeReason.trim()} className="gap-2">
              {revokeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Revogar certificado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DoctorLayout>
  );
}
