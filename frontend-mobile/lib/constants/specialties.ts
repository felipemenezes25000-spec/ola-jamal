/**
 * Lista estática de especialidades (espelha MedicalSpecialtyDisplay no backend).
 * Usada como fallback quando GET /api/specialties falha ou não responde,
 * evitando que o campo fique eternamente em "Carregando...".
 */
export const SPECIALTIES_FALLBACK: string[] = [
  'Clínico Geral',
  'Cardiologia',
  'Dermatologia',
  'Endocrinologia',
  'Ginecologia',
  'Neurologia',
  'Ortopedia',
  'Pediatria',
  'Psiquiatria',
  'Urologia',
];
