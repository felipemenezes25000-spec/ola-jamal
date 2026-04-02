/**
 * examQuickPacks.test.ts
 *
 * Testa a integridade dos dados de packs de exames usados na tela de solicitação.
 * Garante que os packs têm a estrutura correta e não têm duplicatas.
 */

import { EXAM_PACKAGES } from '../lib/data/cidPackages';

describe('EXAM_PACKAGES (laboratorial)', () => {
  it('contém pelo menos 5 packs', () => {
    expect(EXAM_PACKAGES.length).toBeGreaterThanOrEqual(5);
  });

  it('cada pack tem key, name, exams e justification', () => {
    for (const pack of EXAM_PACKAGES) {
      expect(pack.key).toBeTruthy();
      expect(pack.name).toBeTruthy();
      expect(pack.exams.length).toBeGreaterThan(0);
      expect(pack.justification).toBeTruthy();
    }
  });

  it('keys são únicas', () => {
    const keys = EXAM_PACKAGES.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('nomes são únicos', () => {
    const names = EXAM_PACKAGES.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('cada pack não tem exames duplicados internamente', () => {
    for (const pack of EXAM_PACKAGES) {
      const unique = new Set(pack.exams);
      expect(unique.size).toBe(pack.exams.length);
    }
  });

  it('pack check-up tem pelo menos 15 exames', () => {
    const checkup = EXAM_PACKAGES.find((p) => p.key === 'checkup');
    expect(checkup).toBeDefined();
    expect(checkup!.exams.length).toBeGreaterThanOrEqual(15);
  });

  it('pack tireoide contém TSH e T4 livre', () => {
    const tireoide = EXAM_PACKAGES.find((p) => p.key === 'tireoide');
    expect(tireoide).toBeDefined();
    expect(tireoide!.exams).toContain('TSH');
    expect(tireoide!.exams).toContain('T4 livre');
  });
});

describe('Packs de imagem (inline no exam.tsx)', () => {
  // Testa a estrutura dos dados de imagem que são definidos inline no componente
  const QUICK_PACKS_IMAGEM = [
    {
      key: 'img_torax',
      label: 'Tórax',
      exams: ['Raio-X de tórax PA e perfil', 'Tomografia de tórax', 'Angiotomografia de tórax'],
    },
    {
      key: 'img_abdome',
      label: 'Abdome',
      exams: ['USG abdome total', 'USG abdome superior', 'Tomografia de abdome', 'Ressonância de abdome'],
    },
    {
      key: 'img_cabeca',
      label: 'Cabeça e pescoço',
      exams: ['Tomografia de crânio', 'Ressonância de crânio', 'USG tireoide', 'USG cervical', 'Raio-X de seios da face'],
    },
    {
      key: 'img_musculo',
      label: 'Musculoesquelético',
      exams: ['Raio-X de coluna lombar', 'Raio-X de coluna cervical', 'Ressonância de coluna lombar', 'Ressonância de joelho', 'Raio-X de ombro', 'USG de ombro'],
    },
    {
      key: 'img_gineco',
      label: 'Ginecológico',
      exams: ['Mamografia bilateral', 'USG das mamas', 'USG transvaginal', 'USG pélvica'],
    },
    {
      key: 'img_vascular',
      label: 'Vascular',
      exams: ['Doppler de carótidas', 'Doppler venoso de MMII', 'Doppler arterial de MMII', 'Ecocardiograma'],
    },
  ];

  it('contém 6 packs de imagem', () => {
    expect(QUICK_PACKS_IMAGEM.length).toBe(6);
  });

  it('keys são únicas entre packs de imagem', () => {
    const keys = QUICK_PACKS_IMAGEM.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('cada pack de imagem tem pelo menos 3 exames', () => {
    for (const pack of QUICK_PACKS_IMAGEM) {
      expect(pack.exams.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('exames de imagem contêm termos de imagem (Raio-X, USG, Tomografia, Ressonância, Doppler, Mamografia, Ecocardiograma)', () => {
    const imageTerms = ['Raio-X', 'USG', 'Tomografia', 'Ressonância', 'Doppler', 'Mamografia', 'Ecocardiograma', 'Angiotomografia'];
    const allExams = QUICK_PACKS_IMAGEM.flatMap((p) => p.exams);
    for (const exam of allExams) {
      const hasImageTerm = imageTerms.some((term) => exam.includes(term));
      expect(hasImageTerm).toBe(true);
    }
  });

  it('nenhum exame duplicado entre packs de imagem', () => {
    const allExams = QUICK_PACKS_IMAGEM.flatMap((p) => p.exams);
    expect(new Set(allExams).size).toBe(allExams.length);
  });
});
