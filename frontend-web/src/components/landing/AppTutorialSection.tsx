import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, BrainCircuit, Building2, FileText, HeartPulse, ShieldCheck, Stethoscope, Video } from 'lucide-react';

type AudienceKey = 'patient' | 'doctor' | 'management';

const tabs: Array<{ key: AudienceKey; label: string }> = [
  { key: 'patient', label: 'Paciente' },
  { key: 'doctor', label: 'Médico' },
  { key: 'management', label: 'Gestão / Instituição' },
];

const content: Record<
  AudienceKey,
  {
    eyebrow: string;
    title: string;
    description: string;
    items: Array<{ icon: typeof FileText; title: string; description: string }>;
  }
> = {
  patient: {
    eyebrow: 'Jornada do paciente',
    title: 'Acesso simples a jornadas de telemedicina online',
    description:
      'Uma experiência guiada para reduzir deslocamentos, organizar documentos, participar de teleconsultas online e acompanhar o status de cada etapa.',
    items: [
      {
        icon: FileText,
        title: 'Renovação de receitas e pedidos',
        description: 'Fluxos para receita simples, controlada, exames e documentos digitais.',
      },
      {
        icon: HeartPulse,
        title: 'Acompanhamento e prontuário',
        description: 'Histórico, notificações e visualização de documentos assinados em um único lugar.',
      },
      {
        icon: Video,
        title: 'Teleconsulta online e orientação',
        description: 'Acesso a jornadas de atendimento remoto quando a avaliação clínica exigir contato síncrono entre paciente e médico.',
      },
    ],
  },
  doctor: {
    eyebrow: 'Jornada médica',
    title: 'Mais contexto para decidir com segurança e agilidade',
    description:
      'A IA organiza dados e a plataforma estrutura o fluxo de telemedicina online, mas a responsabilidade clínica e a decisão final permanecem integralmente com o profissional.',
    items: [
      {
        icon: BrainCircuit,
        title: 'Triagem assistida por IA',
        description: 'Resumo do caso, leitura documental e organização de informações para revisão mais ágil, sem substituir o julgamento clínico.',
      },
      {
        icon: Stethoscope,
        title: 'Fila, revisão e edição',
        description: 'Avaliação do pedido, ajuste de dados clínicos e aprovação conforme julgamento profissional.',
      },
      {
        icon: ShieldCheck,
        title: 'Assinatura e validade',
        description: 'Documentos com assinatura digital, rastreabilidade e validação pública por QR Code.',
      },
    ],
  },
  management: {
    eyebrow: 'Gestão e governança',
    title: 'Operação mais previsível para instituições e redes',
    description:
      'Capacidades para escalar telemedicina online com visibilidade operacional, controles, governança e integração gradual.',
    items: [
      {
        icon: Building2,
        title: 'Governança e auditoria',
        description: 'Eventos rastreados, trilhas de decisão e apoio a políticas internas e obrigações regulatórias.',
      },
      {
        icon: Activity,
        title: 'Visibilidade operacional',
        description: 'Status de jornadas, filas, pagamentos, documentos emitidos e indicadores de uso.',
      },
      {
        icon: BrainCircuit,
        title: 'Evolução e integração',
        description: 'Base para parcerias com hospitais, clínicas, operadoras e estruturas públicas de saúde.',
      },
    ],
  },
};

export function AppTutorialSection() {
  const [activeTab, setActiveTab] = useState<AudienceKey>('patient');
  const current = useMemo(() => content[activeTab], [activeTab]);

  return (
    <section id="features" className="relative overflow-hidden bg-gradient-to-b from-background via-accent/15 to-background py-16 sm:py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-0 top-0 h-[32rem] w-[32rem] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[32rem] w-[32rem] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="container relative z-10 mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-10 max-w-3xl text-center sm:mb-14"
        >
          <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-wider text-primary">
            Funcionalidades
          </span>
          <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            Funcionalidades organizadas por perfil de uso.
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            A proposta aqui é mostrar, de forma objetiva, como a plataforma pode apoiar modelos públicos
            e privados de telemedicina online sem abrir mão de governança clínica, rastreabilidade e decisão final do médico.
          </p>
        </motion.div>

        <div className="mb-8 flex flex-wrap justify-center gap-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-5 py-3 text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-primary text-white shadow-primary'
                  : 'bg-card text-foreground shadow-card hover:bg-primary/10 hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-intro`}
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3 }}
              className="rounded-[2rem] border border-primary/15 bg-primary/5 p-6 shadow-card sm:p-8"
            >
              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                {current.eyebrow}
              </span>
              <h3 className="mt-5 font-display text-2xl font-bold text-foreground sm:text-3xl">{current.title}</h3>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">{current.description}</p>

              <div className="mt-8 rounded-[1.75rem] border border-border/60 bg-card p-5">
                <div className="grid gap-3">
                  {[
                    'Fluxos mobile-first para telemedicina online e jornadas recorrentes',
                    'Camada de IA assistiva para ganho operacional com supervisão médica',
                    'Trilha auditável e documentação verificável',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl bg-muted/40 px-4 py-3">
                      <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                      <span className="text-sm font-medium text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-items`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.3 }}
              className="grid gap-4"
            >
              {current.items.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.06 }}
                  className="rounded-3xl border border-border/50 bg-card p-6 shadow-card"
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <item.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h4 className="font-display text-xl font-bold text-foreground">{item.title}</h4>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
