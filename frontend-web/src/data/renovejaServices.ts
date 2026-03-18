// renovejaServices.ts
// RenoveJá+ — Financial simulator data model
// Pure data/logic — no React or UI code.

// ---------------------------------------------------------------------------
// 1. SERVICE TYPES & PRICING
// ---------------------------------------------------------------------------

export type ServiceType =
  | 'consulta_clinica'
  | 'consulta_psico'
  | 'receita_simples'
  | 'receita_controlada'
  | 'receita_azul'
  | 'exame_lab'
  | 'exame_imagem'
  | 'atestado'
  | 'encaminhamento';

export interface RenovejaService {
  id: ServiceType;
  name: string;
  category: 'consulta' | 'receita' | 'exame' | 'documento';
  price: number;
  unit: 'por_minuto' | 'por_pedido' | 'por_documento';
  description: string;
  /** Estimated cost to RenoveJá per unit delivered */
  costToDeliver: number;
  /** Gross margin percentage (0–100) */
  marginPct: number;
}

export const RENOVEJA_SERVICES: Record<ServiceType, RenovejaService> = {
  consulta_clinica: {
    id: 'consulta_clinica',
    name: 'Consulta Médico Clínico',
    category: 'consulta',
    price: 6.99,
    unit: 'por_minuto',
    description: 'Consulta com médico clínico geral no modelo banco de horas.',
    costToDeliver: 4.2,
    marginPct: 39.9,
  },
  consulta_psico: {
    id: 'consulta_psico',
    name: 'Consulta Psicólogo',
    category: 'consulta',
    price: 3.99,
    unit: 'por_minuto',
    description: 'Consulta com psicólogo no modelo banco de horas.',
    costToDeliver: 2.2,
    marginPct: 44.9,
  },
  receita_simples: {
    id: 'receita_simples',
    name: 'Receituário Simples',
    category: 'receita',
    price: 29.9,
    unit: 'por_pedido',
    description:
      'Receituário simples: diabetes, pressão, hipotireoidismo, manipulados, analgésicos, ciclo menstrual, vitaminas.',
    costToDeliver: 4.5,
    marginPct: 84.9,
  },
  receita_controlada: {
    id: 'receita_controlada',
    name: 'Receituário Controlado (dupla via)',
    category: 'receita',
    price: 49.9,
    unit: 'por_pedido',
    description:
      'Receituário controlado dupla via: antidepressivos, anticonvulsivantes, indutores do sono, analgésicos controlados.',
    costToDeliver: 7.5,
    marginPct: 85.0,
  },
  receita_azul: {
    id: 'receita_azul',
    name: 'Receituário Azul',
    category: 'receita',
    price: 129.9,
    unit: 'por_pedido',
    description:
      'Receituário azul de alta vigilância sanitária: medicamentos que causam dependência.',
    costToDeliver: 18.0,
    marginPct: 86.1,
  },
  exame_lab: {
    id: 'exame_lab',
    name: 'Pedido de Exame Laboratorial',
    category: 'exame',
    price: 19.9,
    unit: 'por_pedido',
    description: 'Solicitação de exames laboratoriais (hemograma, glicemia, etc.).',
    costToDeliver: 3.0,
    marginPct: 84.9,
  },
  exame_imagem: {
    id: 'exame_imagem',
    name: 'Pedido de Exame de Imagem',
    category: 'exame',
    price: 29.9,
    unit: 'por_pedido',
    description: 'Solicitação de exames de imagem (ultrassonografia, raio-X, etc.).',
    costToDeliver: 3.0,
    marginPct: 90.0,
  },
  atestado: {
    id: 'atestado',
    name: 'Atestado Médico',
    category: 'documento',
    price: 0,
    unit: 'por_documento',
    description: 'Atestado médico incluído na consulta sem custo adicional.',
    costToDeliver: 0.5,
    marginPct: 0,
  },
  encaminhamento: {
    id: 'encaminhamento',
    name: 'Encaminhamento para Especialista',
    category: 'documento',
    price: 0,
    unit: 'por_documento',
    description:
      'Encaminhamento para especialista. Incluído na consulta; gera futuras consultas na plataforma.',
    costToDeliver: 0.5,
    marginPct: 0,
  },
} as const;

// ---------------------------------------------------------------------------
// 2. CONSULTATION OUTCOME PROBABILITIES
// ---------------------------------------------------------------------------

export interface ConsultationOutcome {
  serviceId: ServiceType;
  /** Probability of this outcome occurring per consultation (0–1) */
  probability: number;
  /** Average number of items when the outcome occurs */
  avgQuantity: number;
  description: string;
}

export const CONSULTATION_OUTCOMES: ConsultationOutcome[] = [
  {
    serviceId: 'receita_simples',
    probability: 0.55,
    avgQuantity: 1.3,
    description: 'Mais da metade das consultas resultam em receituário simples.',
  },
  {
    serviceId: 'receita_controlada',
    probability: 0.12,
    avgQuantity: 1.1,
    description: 'Pacientes com condições que requerem medicação controlada.',
  },
  {
    serviceId: 'receita_azul',
    probability: 0.03,
    avgQuantity: 1.0,
    description: 'Casos raros de alta vigilância sanitária.',
  },
  {
    serviceId: 'exame_lab',
    probability: 0.35,
    avgQuantity: 1.5,
    description: 'Solicitação de exames laboratoriais em consultas investigativas.',
  },
  {
    serviceId: 'exame_imagem',
    probability: 0.15,
    avgQuantity: 1.2,
    description: 'Solicitação de exames de imagem para diagnóstico.',
  },
  {
    serviceId: 'atestado',
    probability: 0.3,
    avgQuantity: 1.0,
    description: 'Atestado médico emitido (incluído na consulta, sem receita adicional).',
  },
  {
    serviceId: 'encaminhamento',
    probability: 0.18,
    avgQuantity: 1.0,
    description:
      'Encaminhamento para especialista (incluído na consulta; gera futuras consultas).',
  },
];

// ---------------------------------------------------------------------------
// 3. PATIENT PROFILE ARCHETYPES
// ---------------------------------------------------------------------------

export interface PatientProfile {
  id: string;
  name: string;
  description: string;
  consultasPerYear: number;
  avgConsultDurationMin: number;
  /** Override probabilities per ServiceType for this profile (0–1). Missing keys fall back to CONSULTATION_OUTCOMES. */
  outcomes: Partial<Record<ServiceType, number>>;
  /** Percentage of the total patient base that fits this profile (0–1) */
  populationPct: number;
}

export const PATIENT_PROFILES: PatientProfile[] = [
  {
    id: 'jovem_saudavel',
    name: 'Jovem Saudável',
    description: 'Faixa 18–30 anos, sem doenças crônicas. Consulta principalmente para gripes, atestados e exames preventivos.',
    consultasPerYear: 1.5,
    avgConsultDurationMin: 10,
    outcomes: {
      receita_simples: 0.3,
      receita_controlada: 0.03,
      receita_azul: 0.005,
      exame_lab: 0.2,
      exame_imagem: 0.05,
      atestado: 0.45,
      encaminhamento: 0.08,
    },
    populationPct: 0.28,
  },
  {
    id: 'adulto_cronico',
    name: 'Adulto Crônico',
    description: 'Faixa 30–60 anos, portador de doença crônica (hipertensão, diabetes, hipotireoidismo). Alta demanda por receituário simples e exames.',
    consultasPerYear: 4.2,
    avgConsultDurationMin: 15,
    outcomes: {
      receita_simples: 0.78,
      receita_controlada: 0.12,
      receita_azul: 0.02,
      exame_lab: 0.55,
      exame_imagem: 0.2,
      atestado: 0.25,
      encaminhamento: 0.22,
    },
    populationPct: 0.35,
  },
  {
    id: 'idoso_polimedicado',
    name: 'Idoso Polimedicado',
    description: 'Acima de 60 anos, múltiplas comorbidades. Alta frequência de consultas, receituários controlados e azul.',
    consultasPerYear: 6.8,
    avgConsultDurationMin: 20,
    outcomes: {
      receita_simples: 0.7,
      receita_controlada: 0.28,
      receita_azul: 0.09,
      exame_lab: 0.65,
      exame_imagem: 0.3,
      atestado: 0.1,
      encaminhamento: 0.35,
    },
    populationPct: 0.18,
  },
  {
    id: 'saude_mental',
    name: 'Saúde Mental',
    description: 'Qualquer faixa etária. Consultas frequentes com psicólogo; alta taxa de receituário controlado.',
    consultasPerYear: 8.0,
    avgConsultDurationMin: 25,
    outcomes: {
      receita_simples: 0.15,
      receita_controlada: 0.45,
      receita_azul: 0.08,
      exame_lab: 0.1,
      exame_imagem: 0.03,
      atestado: 0.2,
      encaminhamento: 0.12,
    },
    populationPct: 0.11,
  },
  {
    id: 'eventual',
    name: 'Eventual',
    description: 'Qualquer faixa etária. Acessa a plataforma raramente — principalmente para atestados, exames rápidos ou renovação de receita.',
    consultasPerYear: 1.0,
    avgConsultDurationMin: 12,
    outcomes: {
      receita_simples: 0.35,
      receita_controlada: 0.05,
      receita_azul: 0.01,
      exame_lab: 0.25,
      exame_imagem: 0.1,
      atestado: 0.5,
      encaminhamento: 0.1,
    },
    populationPct: 0.08,
  },
];

// ---------------------------------------------------------------------------
// 4. CITY POTENTIAL MULTIPLIERS
// ---------------------------------------------------------------------------

export interface CityPotentialConfig {
  /** Population range [min, max] (max = Infinity for the top band) */
  popRange: [number, number];
  /** Fraction of population that would use telemedicine (0–1) */
  telemedicineAdoptionRate: number;
  avgConsultsPerUserPerYear: number;
  /** Relative weight for each service type when estimating city revenue mix */
  serviceDistribution: Record<ServiceType, number>;
  /** 0–1; lower value means more competition pressure */
  competitionFactor: number;
  label: string;
}

const BASE_SERVICE_DIST: Record<ServiceType, number> = {
  consulta_clinica: 0.65,
  consulta_psico: 0.35,
  receita_simples: 0.55,
  receita_controlada: 0.12,
  receita_azul: 0.03,
  exame_lab: 0.35,
  exame_imagem: 0.15,
  atestado: 0.3,
  encaminhamento: 0.18,
};

export const CITY_POTENTIAL_CONFIGS: CityPotentialConfig[] = [
  {
    popRange: [0, 9_999],
    telemedicineAdoptionRate: 0.14,
    avgConsultsPerUserPerYear: 3.5,
    serviceDistribution: {
      ...BASE_SERVICE_DIST,
      receita_simples: 0.62,
      exame_lab: 0.4,
    },
    competitionFactor: 0.92,
    label: 'Micro (< 10 mil hab.)',
  },
  {
    popRange: [10_000, 49_999],
    telemedicineAdoptionRate: 0.1,
    avgConsultsPerUserPerYear: 3.2,
    serviceDistribution: {
      ...BASE_SERVICE_DIST,
      receita_simples: 0.58,
      exame_lab: 0.37,
    },
    competitionFactor: 0.82,
    label: 'Pequena (10–50 mil hab.)',
  },
  {
    popRange: [50_000, 199_999],
    telemedicineAdoptionRate: 0.07,
    avgConsultsPerUserPerYear: 3.0,
    serviceDistribution: BASE_SERVICE_DIST,
    competitionFactor: 0.65,
    label: 'Média (50–200 mil hab.)',
  },
  {
    popRange: [200_000, 499_999],
    telemedicineAdoptionRate: 0.05,
    avgConsultsPerUserPerYear: 2.8,
    serviceDistribution: {
      ...BASE_SERVICE_DIST,
      consulta_psico: 0.38,
      receita_controlada: 0.14,
    },
    competitionFactor: 0.48,
    label: 'Grande (200–500 mil hab.)',
  },
  {
    popRange: [500_000, Infinity],
    telemedicineAdoptionRate: 0.035,
    avgConsultsPerUserPerYear: 2.5,
    serviceDistribution: {
      ...BASE_SERVICE_DIST,
      consulta_psico: 0.42,
      receita_controlada: 0.16,
      receita_azul: 0.04,
    },
    competitionFactor: 0.3,
    label: 'Metrópole (500 mil+ hab.)',
  },
];

/** Returns the CityPotentialConfig band for a given population. */
export function getCityConfig(population: number): CityPotentialConfig {
  const config = CITY_POTENTIAL_CONFIGS.find(
    (c) => population >= c.popRange[0] && population <= c.popRange[1],
  );
  // Fallback to last band (Metropole) if none matches
  return config ?? CITY_POTENTIAL_CONFIGS[CITY_POTENTIAL_CONFIGS.length - 1];
}

// ---------------------------------------------------------------------------
// 5. OPERATIONAL COST / REVENUE FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Revenue from a single consultation based on duration and type.
 */
export function calcConsultationRevenue(
  durationMin: number,
  type: 'clinica' | 'psico',
): number {
  const pricePerMin =
    type === 'clinica'
      ? RENOVEJA_SERVICES.consulta_clinica.price
      : RENOVEJA_SERVICES.consulta_psico.price;
  return Math.round(durationMin * pricePerMin * 100) / 100;
}

/**
 * Expected revenue from derivative services (prescriptions, exams, documents)
 * generated from a batch of consultations.
 *
 * @param outcomes - Array of ConsultationOutcome (use CONSULTATION_OUTCOMES or a profile-specific override)
 * @param patientCount - Number of consultations in the batch
 * @returns Array of { service, revenue, volume } sorted by revenue descending
 */
export function calcDerivativeRevenue(
  outcomes: ConsultationOutcome[],
  patientCount: number,
): { service: string; revenue: number; volume: number }[] {
  return outcomes
    .map((outcome) => {
      const service = RENOVEJA_SERVICES[outcome.serviceId];
      const volume =
        Math.round(patientCount * outcome.probability * outcome.avgQuantity * 100) / 100;
      const revenue = Math.round(volume * service.price * 100) / 100;
      return { service: service.name, revenue, volume };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

/**
 * Total expected revenue per consultation including all derivative services.
 *
 * @param avgDuration - Average consultation duration in minutes
 * @param type - 'clinica' or 'psico'
 * @param outcomes - Outcome probabilities to use (defaults to CONSULTATION_OUTCOMES)
 */
export function calcTotalRevenuePerConsultation(
  avgDuration: number,
  type: 'clinica' | 'psico',
  outcomes: ConsultationOutcome[] = CONSULTATION_OUTCOMES,
): number {
  const consultRevenue = calcConsultationRevenue(avgDuration, type);
  const derivativeTotal = outcomes.reduce((sum, outcome) => {
    const service = RENOVEJA_SERVICES[outcome.serviceId];
    const expectedRevenue = outcome.probability * outcome.avgQuantity * service.price;
    return sum + expectedRevenue;
  }, 0);
  return Math.round((consultRevenue + derivativeTotal) * 100) / 100;
}

/**
 * Estimates the revenue potential of a city given its population and a target penetration.
 *
 * @param population - Total city population
 * @param penetrationPct - Target penetration as a fraction of the city's telemedicineAdoptionRate (0–1, e.g. 0.5 = capture 50% of addressable market)
 */
export function calcCityPotential(
  population: number,
  penetrationPct: number,
): {
  totalUsers: number;
  monthlyConsultations: number;
  monthlyRevenue: number;
  annualRevenue: number;
} {
  const config = getCityConfig(population);
  const totalUsers = Math.round(
    population * config.telemedicineAdoptionRate * penetrationPct,
  );
  const annualConsultations = Math.round(
    totalUsers * config.avgConsultsPerUserPerYear,
  );
  const monthlyConsultations = Math.round(annualConsultations / 12);

  // Weighted average duration using PATIENT_PROFILES
  const avgDurationMin =
    PATIENT_PROFILES.reduce(
      (sum, p) => sum + p.avgConsultDurationMin * p.populationPct,
      0,
    ) /
    PATIENT_PROFILES.reduce((sum, p) => sum + p.populationPct, 0);

  // Weighted mix: clinica vs psico from service distribution
  const totalConsultWeight =
    config.serviceDistribution.consulta_clinica +
    config.serviceDistribution.consulta_psico;
  const clinicaPct =
    totalConsultWeight > 0
      ? config.serviceDistribution.consulta_clinica / totalConsultWeight
      : 0.65;

  const revenuePerClinica = calcTotalRevenuePerConsultation(avgDurationMin, 'clinica');
  const revenuePerPsico = calcTotalRevenuePerConsultation(avgDurationMin, 'psico');

  const revenuePerConsultation =
    clinicaPct * revenuePerClinica + (1 - clinicaPct) * revenuePerPsico;

  const annualRevenue = Math.round(annualConsultations * revenuePerConsultation * 100) / 100;
  const monthlyRevenue = Math.round((annualRevenue / 12) * 100) / 100;

  return { totalUsers, monthlyConsultations, monthlyRevenue, annualRevenue };
}

// ---------------------------------------------------------------------------
// 6. OPERATIONAL SCENARIO PRESETS
// ---------------------------------------------------------------------------

export interface OperationalScenario {
  id: string;
  name: string;
  description: string;
  icon: string;
  params: {
    avgConsultDuration: number;
    /** Fraction of consultations handled by clinical doctors (0–1) */
    clinicaPct: number;
    /** Fraction of consultations handled by psychologists (0–1) */
    psicoPct: number;
    workDaysPerMonth: number;
    hoursPerDay: number;
    doctorsPerShift: number;
    psychologistsPerShift: number;
    /** Cost to RenoveJá per doctor per day (R$) */
    doctorCostPerDay: number;
    /** Cost to RenoveJá per psychologist per day (R$) */
    psychologistCostPerDay: number;
  };
}

export const OPERATIONAL_SCENARIOS: OperationalScenario[] = [
  {
    id: 'minimo_viavel',
    name: 'Mínimo Viável',
    description:
      'Operação enxuta de lançamento. Um médico, horário comercial padrão. Ideal para validar o modelo em cidades pequenas.',
    icon: 'seedling',
    params: {
      avgConsultDuration: 12,
      clinicaPct: 1.0,
      psicoPct: 0.0,
      workDaysPerMonth: 22,
      hoursPerDay: 8,
      doctorsPerShift: 1,
      psychologistsPerShift: 0,
      doctorCostPerDay: 480,
      psychologistCostPerDay: 320,
    },
  },
  {
    id: 'crescimento',
    name: 'Crescimento',
    description:
      'Expansão inicial com equipe multidisciplinar. Três médicos e um psicólogo em jornada estendida.',
    icon: 'trending-up',
    params: {
      avgConsultDuration: 13,
      clinicaPct: 0.75,
      psicoPct: 0.25,
      workDaysPerMonth: 25,
      hoursPerDay: 10,
      doctorsPerShift: 3,
      psychologistsPerShift: 1,
      doctorCostPerDay: 480,
      psychologistCostPerDay: 320,
    },
  },
  {
    id: 'escala_regional',
    name: 'Escala Regional',
    description:
      'Operação regional cobrindo múltiplas cidades. Dez médicos e três psicólogos com jornada estendida.',
    icon: 'map',
    params: {
      avgConsultDuration: 14,
      clinicaPct: 0.77,
      psicoPct: 0.23,
      workDaysPerMonth: 26,
      hoursPerDay: 12,
      doctorsPerShift: 10,
      psychologistsPerShift: 3,
      doctorCostPerDay: 460,
      psychologistCostPerDay: 300,
    },
  },
  {
    id: 'dominio_sp',
    name: 'Domínio SP',
    description:
      'Operação de alta escala focada no estado de São Paulo. Cinquenta médicos e quinze psicólogos em jornada intensiva.',
    icon: 'city',
    params: {
      avgConsultDuration: 14,
      clinicaPct: 0.77,
      psicoPct: 0.23,
      workDaysPerMonth: 28,
      hoursPerDay: 14,
      doctorsPerShift: 50,
      psychologistsPerShift: 15,
      doctorCostPerDay: 440,
      psychologistCostPerDay: 290,
    },
  },
  {
    id: 'nacional',
    name: 'Nacional',
    description:
      'Presença nacional. Duzentos médicos e sessenta psicólogos em operação contínua.',
    icon: 'globe',
    params: {
      avgConsultDuration: 15,
      clinicaPct: 0.77,
      psicoPct: 0.23,
      workDaysPerMonth: 30,
      hoursPerDay: 16,
      doctorsPerShift: 200,
      psychologistsPerShift: 60,
      doctorCostPerDay: 420,
      psychologistCostPerDay: 280,
    },
  },
];

// ---------------------------------------------------------------------------
// CONVENIENCE RE-EXPORTS
// ---------------------------------------------------------------------------

export const PRICE_CONSULTA_CLINICA = RENOVEJA_SERVICES.consulta_clinica.price; // R$ 6,99/min
export const PRICE_CONSULTA_PSICO = RENOVEJA_SERVICES.consulta_psico.price;     // R$ 3,99/min
export const PRICE_RECEITA_SIMPLES = RENOVEJA_SERVICES.receita_simples.price;   // R$ 29,90
export const PRICE_RECEITA_CONTROLADA = RENOVEJA_SERVICES.receita_controlada.price; // R$ 49,90
export const PRICE_RECEITA_AZUL = RENOVEJA_SERVICES.receita_azul.price;         // R$ 129,90
export const PRICE_EXAME_LAB = RENOVEJA_SERVICES.exame_lab.price;               // R$ 19,90
export const PRICE_EXAME_IMAGEM = RENOVEJA_SERVICES.exame_imagem.price;         // R$ 29,90
