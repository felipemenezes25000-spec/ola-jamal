import { motion } from 'framer-motion';
import { BadgePlus, Building2, FlaskConical, Pill, ServerCog } from 'lucide-react';

const upcomingFeatures = [
  {
    icon: Pill,
    title: 'Receita Azul',
    description: 'Expansão planejada para fluxos específicos com controles adicionais e governança própria.',
  },
  {
    icon: BadgePlus,
    title: 'Receita Amarela',
    description: 'Evolução gradual da plataforma para novas jornadas reguladas, com implementação faseada.',
  },
  {
    icon: Building2,
    title: 'Integração com prontuário institucional',
    description: 'Conexão progressiva com rotinas hospitalares, clínicas e redes de atenção para reduzir retrabalho.',
  },
  {
    icon: ServerCog,
    title: 'APIs para parceiros',
    description: 'Base para interoperabilidade com sistemas de gestão, portais e fluxos próprios de atendimento.',
  },
  {
    icon: FlaskConical,
    title: 'Ampliação de casos de uso',
    description: 'Mais tipos de documentos, critérios e jornadas conforme evolução operacional e regulatória.',
  },
];

export function AppTestimonialsSection() {
  return (
    <section id="coming-soon" className="relative overflow-hidden bg-background py-16 sm:py-24 lg:py-32">
      <div className="container relative z-10 mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-10 max-w-3xl text-center sm:mb-16"
        >
          <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-wider text-primary">
            Em breve
          </span>
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            Uma plataforma preparada para crescer junto com a operação.
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            A proposta não é parar em um fluxo único. O roadmap foi pensado para ampliar cobertura
            documental, integrações e capacidade institucional ao longo do tempo.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {upcomingFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="group"
            >
              <div className="flex h-full flex-col rounded-3xl border border-border/50 bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                    Em breve
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold text-foreground">{feature.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
