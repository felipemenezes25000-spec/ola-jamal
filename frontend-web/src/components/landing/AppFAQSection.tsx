import { motion } from 'framer-motion';
import { Building2, HeartPulse, Landmark, Stethoscope } from 'lucide-react';

const sectors = [
  {
    icon: Landmark,
    title: 'Órgãos públicos',
    description:
      'Secretarias e estruturas governamentais que precisam reduzir filas, organizar fluxos e ampliar acesso com governança e rastreabilidade.',
  },
  {
    icon: Building2,
    title: 'Hospitais e redes',
    description:
      'Instituições que buscam digitalizar jornadas recorrentes, padronizar emissão documental e ganhar rastreabilidade.',
  },
  {
    icon: Stethoscope,
    title: 'Clínicas e consultórios',
    description:
      'Operações que querem simplificar renovação de documentos, teleatendimento e relacionamento com pacientes.',
  },
  {
    icon: HeartPulse,
    title: 'Operadoras e parceiros',
    description:
      'Estruturas interessadas em interoperabilidade, novos modelos de acesso e apoio à continuidade do cuidado em escala.',
  },
];

export function AppFAQSection() {
  return (
    <section id="partners" className="relative overflow-hidden bg-background py-16 sm:py-24 lg:py-32">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-10 max-w-3xl text-center sm:mb-14"
        >
          <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-wider text-primary">
            Setores atendidos
          </span>
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            Contextos de uso
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            O posicionamento institucional do RenoveJá+ é voltado a organizações que precisam
            organizar jornadas, manter governança clínica e estruturar melhor fluxos recorrentes com apoio digital.
          </p>
        </motion.div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {sectors.map((sector, index) => (
            <motion.div
              key={sector.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="rounded-3xl border border-border/50 bg-card p-6 shadow-card"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <sector.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground">{sector.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{sector.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
