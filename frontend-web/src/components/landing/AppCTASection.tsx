import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Mail, MessageCircle, Send } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

type ContactForm = {
  name: string;
  cpf: string;
  cnpj: string;
  email: string;
  phone: string;
  message: string;
};

const initialForm: ContactForm = {
  name: '',
  cpf: '',
  cnpj: '',
  email: '',
  phone: '',
  message: '',
};

const FORMSPREE_ID = (import.meta.env.VITE_FORMSPREE_FORM_ID ?? '').trim();

function getApiBaseUrl(): string {
  const env = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '');
  if (env) return env;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
}

export function AppCTASection() {
  const [form, setForm] = useState<ContactForm>(initialForm);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const whatsappHref = useMemo(() => {
    const text = encodeURIComponent(
      `Olá! Meu nome é ${form.name || '...'}. Tenho interesse no RenoveJá+.`,
    );
    return `https://wa.me/5511986318000?text=${text}`;
  }, [form.name]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    if (FORMSPREE_ID) {
      setStatus('loading');
      try {
        const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            name: form.name,
            cpf: form.cpf,
            cnpj: form.cnpj,
            email: form.email,
            phone: form.phone,
            message: form.message,
            _subject: `Contato - ${form.name || 'Site'}`,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          errors?: Array<{ message: string }>;
        };
        if (res.ok && data.ok !== false) {
          setStatus('success');
          setForm(initialForm);
        } else {
          setStatus('error');
          const msg =
            data.errors?.map((e) => e.message).join(', ') ||
            data.error ||
            'Falha ao enviar. Tente novamente.';
          setErrorMessage(msg);
        }
      } catch {
        setStatus('error');
        setErrorMessage('Erro de conexão. Tente novamente ou use o WhatsApp.');
      }
      return;
    }

    const apiBase = getApiBaseUrl();
    if (apiBase) {
      setStatus('loading');
      try {
        const res = await fetch(`${apiBase}/api/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            name: form.name,
            cpf: form.cpf || undefined,
            cnpj: form.cnpj || undefined,
            email: form.email,
            phone: form.phone || undefined,
            message: form.message,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
        if (res.ok && data.ok !== false) {
          setStatus('success');
          setForm(initialForm);
        } else {
          setStatus('error');
          setErrorMessage(data.error ?? data.message ?? 'Falha ao enviar. Tente novamente ou use o WhatsApp.');
        }
      } catch {
        setStatus('error');
        setErrorMessage('Erro de conexão. Tente novamente ou use o WhatsApp.');
      }
      return;
    }

    const subject = encodeURIComponent(`Contato - ${form.name || 'Site'}`);
    const body = encodeURIComponent(
      [
        `Nome: ${form.name}`,
        form.cpf && `CPF: ${form.cpf}`,
        form.cnpj && `CNPJ: ${form.cnpj}`,
        `Email: ${form.email}`,
        form.phone && `Telefone: ${form.phone}`,
        '',
        'Mensagem:',
        form.message,
      ]
        .filter(Boolean)
        .join('\n'),
    );
    window.location.href = `mailto:contato@renovejasaude.com.br?subject=${subject}&body=${body}`;
  };

  return (
    <section id="contact" className="relative overflow-hidden bg-app-dark py-16 sm:py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-0 h-64 w-64 rounded-full bg-primary/15 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-primary/15 blur-3xl sm:h-96 sm:w-96" />
      </div>

      <div className="container relative z-10 mx-auto px-4">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center lg:text-left"
          >
            <span className="mb-4 inline-flex rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-primary">
              Contato e parcerias
            </span>
            <h2 className="font-display text-2xl font-bold text-white sm:text-4xl lg:text-5xl">
              Contato institucional
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/70">
              Fale com a equipe para apresentar o seu contexto, discutir possibilidades de uso e
              entender se a plataforma faz sentido para a sua operação.
            </p>

            <div className="mt-8 space-y-4">
              {[
                'Secretarias de saúde, regulação e estruturas governamentais',
                'Hospitais, clínicas, consultórios e redes assistenciais',
                'Operadoras, integradores e parceiros estratégicos',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl bg-white/5 px-4 py-3 text-left"
                >
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <span className="text-sm font-medium text-white/85">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Falar no WhatsApp (abre em nova aba)"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 font-semibold text-white transition-all hover:bg-[#25D366]/90"
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                Falar no WhatsApp
              </a>
              <a
                href="mailto:contato@renovejasaude.com.br"
                aria-label="Escrever por email para contato@renovejasaude.com.br"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white transition-all hover:bg-white/10"
              >
                <Mail className="h-5 w-5" aria-hidden="true" />
                Escrever por email
              </a>
            </div>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            onSubmit={handleSubmit}
            className="rounded-2xl sm:rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-sm sm:p-8"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-medium text-white">Nome completo</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                  autoComplete="name"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm sm:text-base text-white placeholder:opacity-40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 focus:ring-offset-transparent"
                  placeholder="Seu nome completo"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-white">CPF</span>
                <input
                  value={form.cpf}
                  onChange={(e) => setForm((c) => ({ ...c, cpf: e.target.value }))}
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm sm:text-base text-white placeholder:opacity-40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 focus:ring-offset-transparent"
                  placeholder="000.000.000-00"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-white">CNPJ</span>
                <input
                  value={form.cnpj}
                  onChange={(e) => setForm((c) => ({ ...c, cnpj: e.target.value }))}
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm sm:text-base text-white placeholder:opacity-40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 focus:ring-offset-transparent"
                  placeholder="00.000.000/0001-00"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-white">Email</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                  autoComplete="email"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm sm:text-base text-white placeholder:opacity-40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 focus:ring-offset-transparent"
                  placeholder="seu@email.com"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-white">Telefone</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
                  autoComplete="tel"
                  inputMode="tel"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm sm:text-base text-white placeholder:opacity-40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 focus:ring-offset-transparent"
                  placeholder="(11) 99999-9999"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-medium text-white">Mensagem</span>
              <textarea
                required
                rows={4}
                value={form.message}
                onChange={(e) => setForm((c) => ({ ...c, message: e.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm sm:text-base text-white placeholder:opacity-40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/70 focus:ring-offset-2 focus:ring-offset-transparent"
                placeholder="Escreva sua mensagem aqui..."
              />
            </label>

            {/* aria-live region announced to screen readers on status change */}
            <div aria-live="polite" aria-atomic="true" className="mt-6">
              {status === 'success' && (
                <div className="flex items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-400" role="status">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" aria-hidden />
                  <p className="text-sm font-medium">
                    Mensagem enviada! Entraremos em contato em breve.
                  </p>
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400" role="alert">
                  <p className="text-sm font-medium">{errorMessage}</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                type="submit"
                disabled={status === 'loading'}
                className="h-12 flex-1 gap-2 rounded-2xl font-semibold shadow-primary"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" aria-hidden />
                    {FORMSPREE_ID || getApiBaseUrl() ? 'Enviar mensagem' : 'Enviar por email'}
                  </>
                )}
              </Button>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Conversar no WhatsApp (abre em nova aba)"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-[#25D366]/40 bg-[#25D366]/15 px-5 font-semibold text-white transition-all hover:bg-[#25D366]/25"
              >
                <MessageCircle className="h-4 w-4 text-[#25D366]" aria-hidden />
                <span aria-hidden>Conversar no WhatsApp</span>
              </a>
            </div>
          </motion.form>
        </div>
      </div>
    </section>
  );
}
