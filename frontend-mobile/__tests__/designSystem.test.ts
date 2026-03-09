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
      expect(t.colors.primary).toBe('#0EA5E9');
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
      expect(t.colors.text).toBe('#F8FAFC'); // Slate 50
    });

    it('primary permanece igual no dark mode', () => {
      expect(t.colors.primary).toBe('#0EA5E9');
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

    it('fundo unificado com patient no light mode', () => {
      expect(t.colors.background).toBe('#F8FAFC'); // Unificado
    });

    it('texto escuro no doctor', () => {
      expect(t.colors.text).toBe('#0F172A'); // Unificado
    });
  });

  describe('doctor dark', () => {
    const t = createTokens('doctor', 'dark');

    it('fundo escuro doctor (mais profundo que patient)', () => {
      expect(t.colors.background).toBe('#0B1120');
    });

    it('texto claro doctor dark', () => {
      expect(t.colors.text).toBe('#F8FAFC');
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
  });

  describe('invariantes cross-scheme', () => {
    it(' status de erro é consistente entre light e dark (ajustado para legibilidade)', () => {
      const light = createTokens('patient', 'light');
      const dark = createTokens('patient', 'dark');
      // No novo design system, erro no dark é #F87171 (mais claro) para contraste
      expect(light.colors.error).not.toBe(dark.colors.error); 
      expect(dark.colors.error).toBe('#F87171');
    });

    it('primary é consistente entre roles', () => {
      const patient = createTokens('patient', 'light');
      const doctor = createTokens('doctor', 'light');
      expect(patient.colors.primary).toBe(doctor.colors.primary);
    });
  });
});
