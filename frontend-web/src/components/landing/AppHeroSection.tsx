import { motion } from 'framer-motion';
import { ArrowRight, BrainCircuit, Building2, FileCheck2, Shield, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';

const trustIndicators = [
  { icon: BrainCircuit, text: 'IA assistiva para triagem, leitura documental e organização clínica' },
  { icon: Shield, text: 'Telemedicina online com rastreabilidade, LGPD e ICP-Brasil' },
  { icon: FileCheck2, text: 'Receitas, exames, teleconsultas e verificação pública por QR Code' },
];

const institutionPillars = [
  {
    icon: Building2,
    title: 'Aplicação institucional',
    text: 'Adequado para secretarias, hospitais, clínicas, operadoras e redes assistenciais.',
  },
  {
    icon: Stethoscope,
    title: 'Decisão final do médico',
    text: 'A IA auxilia o fluxo, mas a avaliação clínica, a conduta e a emissão permanecem sob responsabilidade do profissional habilitado.',
  },
];

export function AppHeroSection() {
  const scrollToSection = (selector: string) => {
    const element = document.querySelector(selector);
    if (!element) return;

    const offset = 84;
    const top = element.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <section id="hero" className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 gradient-hero" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-[-12rem] h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[-8rem] h-[26rem] w-[26rem] rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="container relative z-10 mx-auto px-4 pb-12 pt-28 sm:pt-32 lg:pt-36">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="space-y-6 text-center lg:text-left"
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary sm:text-sm"
            >
              <Shield className="h-4 w-4" />
              Resolução CFM n.º 2.454/2026
            </motion.div>

            <div className="space-y-4">
              <h1 className="font-display text-3xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl">
                Plataforma de <span className="text-primary">telemedicina online com IA assistiva</span> e decisão final do médico.
              </h1>
              <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0 lg:text-xl">
                O RenoveJá+ apoia governo, hospitais, clínicas e parceiros em jornadas de telemedicina online,
                renovação de receitas, pedidos de exame, teleconsultas e validação documental, com IA assistiva para
                organização do fluxo e decisão final sempre do médico, em linha com a Resolução CFM n.º 2.454/2026.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button
                size="lg"
                onClick={() => scrollToSection('#contact')}
                className="h-12 sm:h-13 gap-2 rounded-2xl px-5 sm:px-7 text-sm sm:text-base font-semibold shadow-primary"
              >
                Entrar em contato
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => scrollToSection('#features')}
                className="h-12 sm:h-13 rounded-2xl border-primary/20 bg-card/70 px-5 sm:px-7 text-sm sm:text-base font-semibold"
              >
                Conhecer funcionalidades
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 lg:justify-start">
              {trustIndicators.map((item) => (
                <span
                  key={item.text}
                  className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-border bg-card px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-sm font-medium text-foreground shadow-card"
                >
                  <item.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  {item.text}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            className="relative mx-auto flex w-full max-w-[30rem] justify-center"
          >
            <div className="relative w-full rounded-[2rem] border border-border/60 bg-card/90 p-5 shadow-2xl backdrop-blur">
              <div className="mb-5 rounded-[1.5rem] bg-gradient-to-br from-primary/15 to-primary/5 p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Plataforma institucional</p>
                    <h2 className="mt-1 text-xl sm:text-2xl font-bold text-foreground">RenoveJá+</h2>
                  </div>
                  <div className="rounded-full bg-success/15 px-3 py-1 text-[10px] sm:text-xs font-semibold text-success">
                    Disponível para avaliação institucional
                  </div>
                </div>

                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                  {institutionPillars.map((pillar) => (
                    <div key={pillar.title} className="rounded-2xl border border-white/40 bg-white/70 p-4 shadow-sm">
                      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10" aria-hidden="true">
                        <pillar.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">{pillar.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pillar.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-[1.5rem] border border-border/70 bg-background p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/60 p-3 sm:p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Capacidades atuais</p>
                    <p className="mt-1 text-base sm:text-lg font-bold text-foreground">Telemedicina online, receita, exame e verificação</p>
                  </div>
                  <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary flex-shrink-0">Atual</div>
                </div>

                <div className="grid gap-3">
                  {[
                    'IA assistiva com supervisão médica e rastreabilidade operacional',
                    'Teleconsulta online com fluxo documentado e acompanhamento digital',
                    'Assinatura digital e verificação pública por QR Code',
                    'Receita azul e amarela em breve',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl bg-muted/40 px-4 py-3">
                      <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                      <span className="text-sm font-medium text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
