import { motion } from 'framer-motion';
import { BadgeCheck, FileSearch, Fingerprint, ShieldCheck, Stethoscope, Telescope } from 'lucide-react';

const complianceItems = [
  {
    icon: Stethoscope,
    title: 'Decisão clínica preservada',
    description:
      'A IA atua como apoio operacional e documental. A decisão final sobre conduta, teleconsulta, emissão e validação continua sendo do médico.',
  },
  {
    icon: ShieldCheck,
    title: 'Conformidade com telemedicina',
    description:
      'Comunicação institucional alinhada ao uso responsável de tecnologia na saúde e à telemedicina online, com destaque para a Resolução CFM n.º 2.454, de 11 de fevereiro de 2026.',
  },
  {
    icon: BadgeCheck,
    title: 'Assinatura ICP-Brasil',
    description:
      'Documentos emitidos com assinatura digital e mecanismos de verificação pública para ampliar confiança e rastreabilidade.',
  },
  {
    icon: Fingerprint,
    title: 'LGPD e trilha auditável',
    description:
      'Eventos registrados, visibilidade de fluxo e suporte a processos internos de governança e proteção de dados.',
  },
  {
    icon: FileSearch,
    title: 'Validação por QR Code',
    description:
      'Receitas e pedidos podem ser consultados por terceiros autorizados em fluxo público de verificação documental.',
  },
  {
    icon: Telescope,
    title: 'Escalabilidade institucional',
    description:
      'Arquitetura orientada a evolução gradual, integrações e adaptação a diferentes modelos de operação.',
  },
];

export function AppPricingSection() {
  return (
    <section id="compliance" className="relative overflow-hidden bg-app-dark py-16 sm:py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-primary/10 blur-3xl sm:h-96 sm:w-96" />
      </div>

      <div className="container relative z-10 mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-10 max-w-3xl text-center sm:mb-16"
        >
          <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-wider text-primary">
            Conformidade e segurança
          </span>
          <h2 className="font-display text-2xl font-bold text-white sm:text-4xl lg:text-5xl">
            Telemedicina online com responsabilidade clínica, jurídica e operacional.
          </h2>
          <p className="mt-6 text-lg text-white/70">
            Esta seção destaca os pilares de confiança necessários para adoção por governo, hospitais,
            clínicas, operadoras e demais parceiros institucionais, com IA assistiva e decisão final sempre do médico.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {complianceItems.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="group"
            >
              <div className="h-full rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
                  <item.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-display text-xl font-bold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
