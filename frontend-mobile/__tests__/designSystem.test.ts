import { createTokens, patientTokens, doctorTokens } from '../lib/designSystem';

describe('createTokens', () => {
  describe('patient light', () => {
    const t = createTokens('patient', 'light');

    it('retorna role e scheme corretos', () => {
      expect(t.role).toBe('patient');
      expect(t.scheme).toBe('light');
    });

    it('fundo claro no light mode', () => {
      expect(t.colors.background).toBe('#F8FAFC');
      expect(t.colors.surface).toBe('#FFFFFF');
    });

    it('texto escuro no light mode', () => {
      expect(t.colors.text).toBe('#0F172A');
    });

    it('primary é consistente', () => {
      expect(t.colors.primary).toBe('#2CB1FF');
    });

    it('exporta spacing completo', () => {
      expect(t.spacing.md).toBe(16);
      expect(t.spacing.lg).toBe(24);
    });

    it('exporta borderRadius com alias radius', () => {
      expect(t.borderRadius).toBeDefined();
      expect(t.radius).toEqual(t.borderRadius);
    });

    it('exporta gradientes', () => {
      expect(t.gradients.patientHeader).toBeDefined();
      expect(Array.isArray(t.gradients.patientHeader)).toBe(true);
    });
  });

  describe('patient dark', () => {
    const t = createTokens('patient', 'dark');

    it('fundo escuro no dark mode', () => {
      expect(t.colors.background).toBe('#0F172A');
      expect(t.colors.surface).toBe('#1E293B');
    });

    it('texto claro no dark mode', () => {
      expect(t.colors.text).toBe('#F1F5F9');
    });

    it('primary permanece igual no dark mode', () => {
      expect(t.colors.primary).toBe('#2CB1FF');
    });

    it('bordas mais escuras no dark mode', () => {
      expect(t.colors.border).toBe('#334155');
    });
  });

  describe('doctor light', () => {
    const t = createTokens('doctor', 'light');

    it('retorna role doctor', () => {
      expect(t.role).toBe('doctor');
    });

    it('fundo levemente diferente do patient', () => {
      expect(t.colors.background).toBe('#F4F6F9');
    });

    it('texto mais escuro no doctor', () => {
      expect(t.colors.text).toBe('#121A3E');
    });
  });

  describe('doctor dark', () => {
    const t = createTokens('doctor', 'dark');

    it('fundo escuro doctor', () => {
      expect(t.colors.background).toBe('#0D1B2A');
    });

    it('texto claro doctor dark', () => {
      expect(t.colors.text).toBe('#E2E8F0');
    });
  });

  describe('tokens estáticos pré-criados', () => {
    it('patientTokens é light', () => {
      expect(patientTokens.scheme).toBe('light');
      expect(patientTokens.role).toBe('patient');
    });

    it('doctorTokens é light', () => {
      expect(doctorTokens.scheme).toBe('light');
      expect(doctorTokens.role).toBe('doctor');
    });

    it('patientTokens e doctorTokens diferem no background', () => {
      expect(patientTokens.colors.background).not.toBe(doctorTokens.colors.background);
    });
  });

  describe('invariantes cross-scheme', () => {
    it('status de erro é consistente entre light e dark', () => {
      const light = createTokens('patient', 'light');
      const dark = createTokens('patient', 'dark');
      expect(light.colors.error).toBe(dark.colors.error);
    });

    it('primary é consistente entre roles', () => {
      const patient = createTokens('patient', 'light');
      const doctor = createTokens('doctor', 'light');
      expect(patient.colors.primary).toBe(doctor.colors.primary);
    });
  });
});
