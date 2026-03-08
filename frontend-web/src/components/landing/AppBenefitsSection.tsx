import { motion } from 'framer-motion';
import { BrainCircuit, FileCheck2, LockKeyhole, ScanSearch, ShieldCheck, Stethoscope } from 'lucide-react';

const solutions = [
  {
    icon: BrainCircuit,
    title: 'IA assistiva, não autônoma',
    description:
      'A plataforma apoia leitura documental, triagem e organização de informações nas jornadas de telemedicina online, mantendo a decisão final com o médico.',
  },
  {
    icon: Stethoscope,
    title: 'Telemedicina online com supervisão clínica',
    description:
      'Solicitações, teleconsultas e emissões passam por revisão profissional, com visibilidade da fila, critérios clínicos e possibilidade de ajuste antes da emissão.',
  },
  {
    icon: FileCheck2,
    title: 'Documento válido e verificável',
    description:
      'Receitas e pedidos podem ser assinados digitalmente com ICP-Brasil e validados publicamente por QR Code.',
  },
  {
    icon: LockKeyhole,
    title: 'Governança e rastreabilidade',
    description:
      'Cada etapa do fluxo fica registrada para auditoria, apoio à conformidade institucional e análise operacional.',
  },
  {
    icon: ShieldCheck,
    title: 'Conformidade de ponta a ponta',
    description:
      'Arquitetura pensada para LGPD, trilha de auditoria e alinhamento com regras regulatórias aplicáveis à telemedicina, incluindo a Resolução CFM n.º 2.454/2026.',
  },
  {
    icon: ScanSearch,
    title: 'Jornada mais simples para o cidadão',
    description:
      'Menos papel, menos fila e menos ruído entre solicitação, análise, assinatura e acesso ao documento.',
  },
];

export function AppBenefitsSection() {
  return (
    <section id="solution" className="relative overflow-hidden bg-background py-16 sm:py-24 lg:py-32">
      <div className="container relative z-10 mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-10 max-w-3xl text-center sm:mb-16"
        >
          <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-wider text-primary">
            A solução
          </span>
          <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            Telemedicina online com apoio operacional, rastreabilidade e responsabilidade clínica preservada.
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            O RenoveJá+ foi desenhado para apoiar pacientes, médicos e gestores em jornadas digitais de telemedicina,
            com uso responsável de IA assistiva, fluxos auditáveis e decisão final sempre do médico.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {solutions.map((solution, index) => (
            <motion.div
              key={solution.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="group"
            >
              <div className="h-full rounded-3xl border border-border/50 bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 transition-colors group-hover:bg-primary">
                  <solution.icon className="h-7 w-7 text-primary transition-colors group-hover:text-white" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground">{solution.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{solution.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
