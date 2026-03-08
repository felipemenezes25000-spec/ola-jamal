import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pill,
  Sparkles,
  Stethoscope,
  Video,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';

type ScreenSlide = {
  id: number;
  title: string;
  description: string;
  content: ReactNode;
};

function MiniSectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
      {children}
    </p>
  );
}

function MiniCard({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'primary' | 'success' | 'warning';
}) {
  const toneClasses = {
    default: 'border-slate-200 bg-white',
    primary: 'border-primary/20 bg-primary/5',
    success: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
  };

  return <div className={`rounded-2xl border p-3 shadow-sm ${toneClasses[tone]}`}>{children}</div>;
}

function MiniTag({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'primary' | 'success' | 'warning';
}) {
  const toneClasses = {
    default: 'bg-slate-100 text-slate-600',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
  };

  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

function StatusStep({
  label,
  state,
  last = false,
}: {
  label: string;
  state: 'done' | 'current' | 'pending';
  last?: boolean;
}) {
  const dotClasses =
    state === 'done'
      ? 'border-emerald-500 bg-emerald-500 text-white'
      : state === 'current'
        ? 'border-primary bg-primary text-white'
        : 'border-slate-300 bg-white text-slate-400';

  const textClasses =
    state === 'done' ? 'text-emerald-600' : state === 'current' ? 'text-primary' : 'text-slate-400';

  return (
    <div className="flex gap-3">
      <div className="flex w-5 flex-col items-center">
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] font-bold ${dotClasses}`}
        >
          {state === 'done' ? '✓' : state === 'current' ? '•' : ''}
        </div>
        {!last && (
          <div
            className={`mt-1 h-8 w-[2px] rounded-full ${state === 'done' ? 'bg-emerald-500' : 'bg-slate-200'}`}
          />
        )}
      </div>
      <div className="pt-0.5">
        <p className={`text-xs font-semibold ${textClasses}`}>{label}</p>
        {state === 'current' && (
          <p className="mt-1 text-[10px] font-medium text-primary">Etapa atual</p>
        )}
      </div>
    </div>
  );
}

function RequestListItem({
  type,
  accent,
  status,
  subtitle,
}: {
  type: string;
  accent: string;
  status: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className={`mt-0.5 h-10 w-1 rounded-full ${accent}`} />
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm">
        +
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-bold text-slate-900">{type}</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {status}
          </span>
        </div>
        <p className="mt-1 truncate text-[11px] text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

const screens: ScreenSlide[] = [
  {
    id: 1,
    title: 'Nova solicitação de receita',
    description:
      'Tela real do app para seleção do tipo de receituário, envio de foto e revisão em modo claro.',
    content: (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">Renovação de Receita</p>
            <p className="text-[11px] text-slate-500">Fluxo guiado em 3 etapas</p>
          </div>
          <div className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
            2/3
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {['Tipo', 'Foto', 'Revisão'].map((item, index) => (
            <div
              key={item}
              className={`rounded-xl px-2 py-2 text-center text-[10px] font-semibold ${
                index < 2 ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {item}
            </div>
          ))}
        </div>

        <MiniCard tone="primary">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              IA
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">
                Dra. Renoveja: qualidade do envio
              </p>
              <p className="mt-1 text-[11px] text-slate-600">Seu pedido está 67% pronto</p>
              <p className="mt-1 text-[11px] text-slate-500">
                • Adicione ao menos 1 foto da receita
              </p>
            </div>
          </div>
        </MiniCard>

        <div className="space-y-2">
          <MiniSectionTitle>Tipo de receita</MiniSectionTitle>
          <MiniCard>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-900">Receituário simples</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Uso contínuo, com fluxo guiado e revisão posterior.
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                Selecionado
              </span>
            </div>
          </MiniCard>
        </div>

        <div className="space-y-2">
          <MiniSectionTitle>Foto da receita</MiniSectionTitle>
          <MiniCard tone="warning">
            <p className="text-[11px] font-medium text-amber-700">
              Envie somente fotos da receita. Outras imagens são rejeitadas.
            </p>
          </MiniCard>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                +
              </div>
              <p className="text-[11px] font-semibold text-slate-700">Câmera</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                +
              </div>
              <p className="text-[11px] font-semibold text-slate-700">Galeria</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 2,
    title: 'Lista de pedidos com status',
    description:
      'A listagem do paciente mostra filtros, busca, resumo operacional e cards reais de acompanhamento.',
    content: (
      <div className="space-y-3">
        <div className="rounded-2xl bg-[linear-gradient(135deg,#12395f,#1f6aa5)] px-4 py-3 text-white shadow-sm">
          <p className="text-sm font-bold">Meus pedidos</p>
          <p className="text-[11px] text-white/75">Receitas, exames e consultas</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            ['Total', '12'],
            ['Pag. pendente', '2'],
            ['No filtro', '4'],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white px-2 py-2 text-center shadow-sm"
            >
              <p className="text-[10px] text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-400 shadow-sm">
          Buscar pedidos
        </div>

        <div className="flex gap-2 overflow-hidden rounded-2xl bg-slate-100 p-1">
          <div className="rounded-xl bg-white px-3 py-2 text-[10px] font-semibold text-slate-900 shadow-sm">
            Todos
          </div>
          <div className="rounded-xl px-3 py-2 text-[10px] font-semibold text-slate-500">
            Receitas
          </div>
          <div className="rounded-xl px-3 py-2 text-[10px] font-semibold text-slate-500">
            Exames
          </div>
        </div>

        <div className="space-y-2">
          <RequestListItem
            type="Receita"
            accent="bg-sky-500"
            status="Em análise"
            subtitle="Dr(a). Maria Silva • 08 Mar"
          />
          <RequestListItem
            type="Exame"
            accent="bg-slate-400"
            status="Pago"
            subtitle="Pedido com documento anexado"
          />
          <RequestListItem
            type="Consulta"
            accent="bg-emerald-500"
            status="Pronta"
            subtitle="Teleconsulta liberada para entrada"
          />
        </div>
      </div>
    ),
  },
  {
    id: 3,
    title: 'Detalhe do pedido e próxima ação',
    description:
      'A tela de detalhe acompanha cada etapa, mostra orientações e libera ações como download do documento.',
    content: (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900">Receita</p>
          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
            Assinado
          </span>
        </div>

        <MiniCard>
          <p className="mb-3 text-xs font-bold text-slate-900">Status do pedido</p>
          <div className="space-y-0">
            <StatusStep label="Enviado" state="done" />
            <StatusStep label="Em análise" state="done" />
            <StatusStep label="Pago" state="done" />
            <StatusStep label="Assinado" state="current" />
            <StatusStep label="Entregue" state="pending" last />
          </div>
        </MiniCard>

        <MiniCard tone="primary">
          <p className="text-xs font-bold text-slate-900">Dra. Renoveja</p>
          <p className="mt-1 text-[11px] text-slate-600">
            Documento pronto para conferência e download.
          </p>
          <div className="mt-3 rounded-xl bg-primary px-3 py-2 text-center text-[11px] font-semibold text-primary-foreground">
            Baixar receita
          </div>
        </MiniCard>

        <MiniCard>
          <p className="mb-2 text-xs font-bold text-slate-900">Detalhes da solicitação</p>
          <div className="space-y-2 text-[11px]">
            <div className="flex items-center justify-between text-slate-500">
              <span>Controle</span>
              <span className="font-semibold text-slate-800">Receita Simples</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Médico</span>
              <span className="font-semibold text-slate-800">Dra. Ana Paula</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Criado em</span>
              <span className="font-semibold text-slate-800">08/03/2026</span>
            </div>
          </div>
        </MiniCard>
      </div>
    ),
  },
  {
    id: 4,
    title: 'Prontuário com documentos emitidos',
    description:
      'A aba de prontuário organiza histórico, timeline e documentos assinados em uma experiência clara e leve.',
    content: (
      <div className="space-y-3">
        <div className="rounded-2xl bg-[linear-gradient(135deg,#153b63,#266aa0)] px-4 py-3 text-white shadow-sm">
          <p className="text-sm font-bold">Prontuário</p>
          <p className="text-[11px] text-white/75">Resumo, timeline e documentos</p>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
          {['Resumo', 'Timeline', 'Documentos'].map((tab, index) => (
            <div
              key={tab}
              className={`rounded-xl px-2 py-2 text-center text-[10px] font-semibold ${
                index === 2 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {tab}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {['Todos', 'Receitas', 'Exames'].map((chip, index) => (
            <div
              key={chip}
              className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${
                index === 0 ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {chip}
            </div>
          ))}
        </div>

        <MiniCard>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-900">Receita</p>
              <p className="mt-1 text-[11px] text-slate-500">Assinada em 08 Mar 2026</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
              Assinado
            </span>
          </div>
        </MiniCard>

        <MiniCard>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-900">Pedido de exame</p>
              <p className="mt-1 text-[11px] text-slate-500">Emitido após avaliação clínica</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
              Assinado
            </span>
          </div>
        </MiniCard>

        <MiniCard tone="success">
          <p className="text-[11px] font-medium text-emerald-700">
            Documentos com histórico organizado para consulta posterior.
          </p>
        </MiniCard>
      </div>
    ),
  },
  {
    id: 5,
    title: 'Consulta por vídeo com IA assistiva',
    description:
      'A IA organiza a anamnese, destaca sintomas, sugere CID e medicamentos relacionados, aponta base científica e deixa claro que a conduta final pertence ao médico.',
    content: (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Video className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Consulta Breve +</p>
              <p className="text-[11px] text-slate-500">Anamnese guiada e revisão clínica</p>
            </div>
          </div>
          <MiniTag tone="primary">Ao vivo</MiniTag>
        </div>

        <MiniCard tone="primary">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900">Dra. Renoveja resumiu a consulta</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                Cefaleia ha 3 dias, sem febre, piora no fim da tarde e melhora parcial com repouso.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <MiniTag tone="warning">Sintoma principal: dor de cabeca</MiniTag>
                <MiniTag>Sem febre</MiniTag>
                <MiniTag>Sem sinal de urgencia</MiniTag>
              </div>
            </div>
          </div>
        </MiniCard>

        <div className="space-y-2">
          <MiniSectionTitle>Hipoteses e apoio cientifico</MiniSectionTitle>
          <MiniCard>
            <div className="flex items-start gap-2">
              <Stethoscope className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900">CID sugerido pela IA</p>
                <p className="mt-1 text-[11px] text-slate-600">R51 - Cefaleia</p>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                  Sugestao automatica para apoio. O medico pode confirmar, ajustar ou descartar.
                </p>
              </div>
            </div>
          </MiniCard>

          <MiniCard>
            <div className="flex items-start gap-2">
              <Pill className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900">Medicamentos relacionados</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <MiniTag tone="success">Dipirona</MiniTag>
                  <MiniTag tone="success">Paracetamol</MiniTag>
                  <MiniTag>Hidratacao</MiniTag>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                  Lista apenas de apoio clinico. Prescricao e orientacao final dependem da avaliacao medica.
                </p>
              </div>
            </div>
          </MiniCard>

          <MiniCard>
            <div className="flex items-start gap-2">
              <BookOpen className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900">Documentacao cientifica consultada</p>
                <div className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-slate-500">
                  <p>• Diretriz de cefaleias primarias para triagem inicial</p>
                  <p>• Protocolo de sinais de alarme e encaminhamento</p>
                  <p>• Referencias farmacologicas para analgesicos usuais</p>
                </div>
              </div>
            </div>
          </MiniCard>
        </div>

        <MiniCard tone="success">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
              <Stethoscope className="h-3.5 w-3.5 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Decisao final do medico</p>
              <p className="mt-1 text-[11px] leading-relaxed text-emerald-700">
                Conduta aprovada apos avaliacao clinica. A IA apoia a organizacao da consulta, mas a decisao
                final, a orientacao e a prescricao sao exclusivamente medicas.
              </p>
            </div>
          </div>
        </MiniCard>
      </div>
    ),
  },
];

export function AppScreensSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % screens.length);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + screens.length) % screens.length);

  return (
    <section id="screenshots" className="relative overflow-hidden bg-background py-24 lg:py-32">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-16 max-w-3xl text-center"
        >
          <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-wider text-primary">
            Telas do app
          </span>
          <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            Conheça a <span className="text-gradient">plataforma em uso</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            Uma amostra da jornada digital que ajuda instituições a organizar solicitações, validar
            documentos e ampliar acesso com mais previsibilidade operacional.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mb-12 flex justify-center"
        >
          <div className="inline-flex items-center gap-3 rounded-full border border-success/20 bg-success/10 px-6 py-3 shadow-card">
            <div className="h-2.5 w-2.5 rounded-full bg-success" />
            <span className="text-sm font-medium text-foreground">
              Telas baseadas no <strong className="text-success">app real em modo claro</strong>,
              com jornadas de envio, acompanhamento e documentos.
            </span>
            <Clock3 className="h-5 w-5 text-success" />
          </div>
        </motion.div>

        <div className="relative mx-auto max-w-4xl">
          <Button
            variant="outline"
            size="icon"
            onClick={prevSlide}
            className="absolute left-0 top-1/2 z-10 hidden -translate-x-4 -translate-y-1/2 rounded-full shadow-lg sm:flex lg:-translate-x-12"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={nextSlide}
            className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 translate-x-4 rounded-full shadow-lg sm:flex lg:translate-x-12"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          <div className="flex justify-center">
            <div className="relative">
              <div className="aspect-[9/19] w-[280px] rounded-[3rem] bg-slate-900 p-3 shadow-elevated sm:w-[300px]">
                <div className="h-full w-full overflow-hidden rounded-[2.5rem] bg-[#f6f8fb]">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
                    <span className="text-xs font-medium text-slate-900">9:41</span>
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-4 rounded-sm border border-slate-900">
                        <div className="h-full w-3/4 rounded-sm bg-success" />
                      </div>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentIndex}
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.3 }}
                      className="h-full px-4 py-4"
                    >
                      {screens[currentIndex].content}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="absolute left-1/2 top-3 h-6 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
              </div>
            </div>
          </div>

          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 text-center"
          >
            <h3 className="mb-2 font-display text-xl font-bold text-foreground">
              {screens[currentIndex].title}
            </h3>
            <p className="text-muted-foreground">{screens[currentIndex].description}</p>
          </motion.div>

          <div className="mt-6 flex justify-center gap-2">
            {screens.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`h-2 w-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'w-8 bg-primary'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                aria-label={`Ir para slide ${index + 1}`}
              />
            ))}
          </div>

          <div className="mt-6 flex justify-center gap-4 sm:hidden">
            <Button variant="outline" size="sm" onClick={prevSlide}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Anterior
            </Button>
            <Button variant="outline" size="sm" onClick={nextSlide}>
              Próximo
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
