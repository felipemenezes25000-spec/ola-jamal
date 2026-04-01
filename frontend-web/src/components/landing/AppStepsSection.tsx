import { motion } from 'framer-motion';
import { Clock3, FileClock, MapPinned, UsersRound } from 'lucide-react';

const problems = [
  {
    icon: Clock3,
    title: 'Filas prolongadas e sobrecarga assistencial',
    description:
      'Parte relevante da capacidade assistencial ainda é consumida por fluxos administrativos, reavaliações simples e etapas repetitivas.',
  },
  {
    icon: FileClock,
    title: 'Renovação burocrática de documentos',
    description:
      'Receitas, pedidos de exame e reemissões costumam depender de processos manuais, ligações e deslocamentos evitáveis.',
  },
  {
    icon: MapPinned,
    title: 'Acesso desigual entre territórios',
    description:
      'Pacientes e equipes em regiões remotas ou com baixa cobertura enfrentam mais barreiras para triagem, acompanhamento e emissão documental.',
  },
];

export function AppStepsSection() {
  return (
    <section id="problem" className="relative overflow-hidden bg-background py-16 sm:py-24 lg:py-32">
      <div className="container relative z-10 mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-10 max-w-3xl text-center sm:mb-14"
        >
          <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-wider text-primary">
            O problema
          </span>
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            Fluxos administrativos ainda consomem tempo assistencial.
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            O desafio não é apenas digitalizar documentos. Em muitos cenários, tambem envolve reduzir fricção
            operacional, organizar a demanda e dar mais previsibilidade ao atendimento.
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {problems.map((problem, index) => (
              <motion.div
                key={problem.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="rounded-3xl border border-border/60 bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-elevated"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <problem.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground">{problem.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{problem.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-[2rem] border border-primary/20 bg-primary/5 p-6 shadow-card"
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-primary">
              <UsersRound className="h-7 w-7" />
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-foreground">Saúde pública e suplementar exigem escala com governança.</h3>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              A proposta da plataforma é apoiar instituições a organizar jornadas recorrentes sem substituir a avaliação
              clínica, preservando rastreabilidade, segurança documental e responsabilidade médica.
            </p>

            <div className="mt-6 space-y-3">
              {[
                'Menos deslocamentos desnecessários para demandas simples',
                'Mais previsibilidade para regulação, atendimento e gestão',
                'Jornada documentada com trilha auditável ponta a ponta',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl bg-background/80 px-4 py-3">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <span className="text-sm font-medium text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
