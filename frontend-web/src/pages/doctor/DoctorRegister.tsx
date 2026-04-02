import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { registerDoctorFull, fetchSpecialties, fetchAddressByCep, type Specialty } from '@/services/doctorApi';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Loader2, Stethoscope, ArrowLeft, ArrowRight, User, Mail, Lock, Phone, CreditCard,
  MapPin, Building2, Eye, EyeOff, CheckCircle2,
} from 'lucide-react';

const UF_LIST = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA',
  'PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

type Step = 'personal' | 'professional' | 'address' | 'security';

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: 'personal', label: 'Dados Pessoais', icon: User },
  { key: 'professional', label: 'Dados Médicos', icon: Stethoscope },
  { key: 'address', label: 'Endereço', icon: MapPin },
  { key: 'security', label: 'Segurança', icon: Lock },
];

export default function DoctorRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('personal');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', cpf: '',
    crm: '', crmState: '', specialtyId: '', rqe: '',
    professionalPhone: '',
    cep: '', city: '', state: '', professionalAddress: '',
    password: '', confirmPassword: '',
  });

  useEffect(() => {
    let cancelled = false;
    fetchSpecialties()
      .then((data) => { if (!cancelled) setSpecialties(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCepBlur = async () => {
    if (!form.cep || form.cep.replace(/\D/g, '').length < 8) return;
    try {
      const addr = await fetchAddressByCep(form.cep);
      if (addr) {
        setForm(prev => ({
          ...prev,
          city: addr.city,
          state: addr.state,
          professionalAddress: addr.street ? `${addr.street}, ${addr.neighborhood}` : prev.professionalAddress,
        }));
      }
    } catch {
      // CEP lookup failure is non-critical — user can fill fields manually
    }
  };

  const currentIdx = STEPS.findIndex(s => s.key === step);

  const canAdvance = () => {
    switch (step) {
      case 'personal': return form.name && form.email && form.phone && form.cpf;
      case 'professional': return form.crm && form.crmState && form.specialtyId;
      case 'address': return form.city && form.state;
      case 'security': return form.password && form.confirmPassword && form.password === form.confirmPassword && form.password.length >= 8;
      default: return false;
    }
  };

  const handleNext = () => {
    if (!canAdvance()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    const nextIdx = currentIdx + 1;
    if (nextIdx < STEPS.length) setStep(STEPS[nextIdx].key);
  };

  const handleBack = () => {
    const prevIdx = currentIdx - 1;
    if (prevIdx >= 0) setStep(STEPS[prevIdx].key);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdvance()) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setLoading(true);
    try {
      const specialtyName = specialties.find(s => s.id === form.specialtyId)?.name ?? form.specialtyId;
      await registerDoctorFull({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        cpf: form.cpf,
        crm: form.crm,
        crmState: form.crmState,
        specialty: specialtyName,
        professionalPhone: form.professionalPhone || undefined,
        rqe: form.rqe || undefined,
        cep: form.cep || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        professionalAddress: form.professionalAddress || undefined,
      });
      toast.success('Conta criada! Aguarde a aprovação do seu cadastro.');
      navigate('/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg relative z-10"
      >
        <Card className="shadow-xl border-border/50">
          <CardHeader className="text-center space-y-3 pb-2">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                <Stethoscope className="h-7 w-7 text-primary-foreground" />
              </div>
            </div>
            <div>
              <CardTitle className="text-xl">Cadastro de Médico</CardTitle>
              <CardDescription className="mt-1">Crie sua conta para acessar o portal</CardDescription>
            </div>

            {/* Stepper */}
            <div className="flex items-center justify-center gap-1 sm:gap-2 pt-2 overflow-x-auto">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => i < currentIdx && setStep(s.key)}
                    disabled={i > currentIdx}
                    className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      s.key === step
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : i < currentIdx
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {i < currentIdx ? (
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                    ) : (
                      <s.icon className="h-3.5 w-3.5 flex-shrink-0" />
                    )}
                    <span className="hidden sm:inline">{s.label}</span>
                    <span className="sm:hidden">{i + 1}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`w-4 sm:w-6 h-0.5 flex-shrink-0 ${i < currentIdx ? 'bg-primary' : 'bg-border'}`} />
                  )}
                </div>
              ))}
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {step === 'personal' && (
                <motion.div key="personal" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome completo *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                      <Input id="name" autoComplete="name" placeholder="Dr. João Silva" value={form.name} onChange={e => updateField('name', e.target.value)} className="pl-10" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                      <Input id="reg-email" type="email" placeholder="joao@email.com" value={form.email} onChange={e => updateField('email', e.target.value)} className="pl-10" required autoComplete="email" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone *</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                        <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={form.phone} onChange={e => updateField('phone', e.target.value)} className="pl-10" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF *</Label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                        <Input id="cpf" inputMode="numeric" placeholder="000.000.000-00" value={form.cpf} onChange={e => updateField('cpf', e.target.value)} className="pl-10" required />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 'professional' && (
                <motion.div key="professional" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="crm">CRM *</Label>
                      <Input id="crm" inputMode="numeric" placeholder="123456" value={form.crm} onChange={e => updateField('crm', e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crmState">UF do CRM *</Label>
                      <Select value={form.crmState} onValueChange={v => updateField('crmState', v)}>
                        <SelectTrigger id="crmState"><SelectValue placeholder="UF" /></SelectTrigger>
                        <SelectContent>
                          {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="specialty">Especialidade *</Label>
                    <Select value={form.specialtyId} onValueChange={v => updateField('specialtyId', v)}>
                      <SelectTrigger id="specialty"><SelectValue placeholder="Selecione a especialidade" /></SelectTrigger>
                      <SelectContent>
                        {specialties.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rqe">RQE (se especialista)</Label>
                    <Input id="rqe" inputMode="numeric" placeholder="Ex.: 12345" value={form.rqe} onChange={e => updateField('rqe', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profPhone">Telefone profissional</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                      <Input id="profPhone" placeholder="(11) 3333-4444" value={form.professionalPhone} onChange={e => updateField('professionalPhone', e.target.value)} className="pl-10" />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 'address' && (
                <motion.div key="address" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                      <Input id="cep" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={form.cep} onChange={e => updateField('cep', e.target.value)} onBlur={handleCepBlur} className="pl-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço profissional</Label>
                    <Input id="address" placeholder="Rua, número, complemento" value={form.professionalAddress} onChange={e => updateField('professionalAddress', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="city">Cidade *</Label>
                      <Input id="city" placeholder="São Paulo" value={form.city} onChange={e => updateField('city', e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">UF *</Label>
                      <Select value={form.state} onValueChange={v => updateField('state', v)}>
                        <SelectTrigger id="state"><SelectValue placeholder="UF" /></SelectTrigger>
                        <SelectContent>
                          {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 'security' && (
                <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Senha *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                      <Input
                        id="reg-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 8 caracteres"
                        value={form.password}
                        onChange={e => updateField('password', e.target.value)}
                        className="pl-10 pr-10"
                        required
                        minLength={8}
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Mostrar senha">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar senha *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                      <Input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Repita a senha"
                        value={form.confirmPassword}
                        onChange={e => updateField('confirmPassword', e.target.value)}
                        className="pl-10"
                        required
                        autoComplete="new-password"
                      />
                    </div>
                    {form.confirmPassword && form.password !== form.confirmPassword && (
                      <p className="text-xs text-destructive">As senhas não coincidem</p>
                    )}
                  </div>
                  <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 space-y-2">
                    <p className="text-sm font-medium text-foreground">Ao criar sua conta, você concorda com:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Termos de Uso e Política de Privacidade</li>
                      <li>• Código de Ética Médica do CFM</li>
                      <li>• Seu cadastro será analisado antes da aprovação</li>
                    </ul>
                  </div>
                </motion.div>
              )}

              <div className="flex gap-3 pt-2">
                {currentIdx > 0 && (
                  <Button type="button" variant="outline" onClick={handleBack} className="flex-1 h-11">
                    <ArrowLeft className="h-4 w-4 mr-2" aria-hidden />
                    Voltar
                  </Button>
                )}
                {currentIdx < STEPS.length - 1 ? (
                  <Button type="button" onClick={handleNext} className="flex-1 h-11" disabled={!canAdvance()}>
                    Próximo
                    <ArrowRight className="h-4 w-4 ml-2" aria-hidden />
                  </Button>
                ) : (
                  <Button type="submit" className="flex-1 h-11" disabled={loading || !canAdvance()}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden /> : null}
                    Criar Conta
                  </Button>
                )}
              </div>

              <p className="text-center text-sm text-muted-foreground pt-2">
                Já tem conta?{' '}
                <Link to="/login" className="text-primary font-medium hover:text-primary/80 transition-colors">
                  Fazer login
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
