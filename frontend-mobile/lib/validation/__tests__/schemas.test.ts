import { loginSchema, registerSchema, completeProfileSchema, createConsultationSchema } from '../schemas';

describe('schemas', () => {
  describe('loginSchema', () => {
    it('accepts valid email and password', () => {
      const result = loginSchema.safeParse({ email: 'user@example.com', password: 'secret' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
      }
    });

    it('rejects empty email', () => {
      const result = loginSchema.safeParse({ email: '', password: 'x' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
      const result = loginSchema.safeParse({ email: 'notanemail', password: 'x' });
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('accepts valid patient data', () => {
      const result = registerSchema.safeParse({
        name: 'João Silva',
        email: 'joao@test.com',
        password: 'senha1234',
        phone: '11999999999',
        cpf: '12345678901',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBe('11999999999');
        expect(result.data.cpf).toBe('12345678901');
      }
    });

    it('rejects name with single word', () => {
      const result = registerSchema.safeParse({
        name: 'João',
        email: 'j@t.com',
        password: 'senha1234',
        phone: '11999999999',
        cpf: '12345678901',
      });
      expect(result.success).toBe(false);
    });

    it('rejects short password', () => {
      const result = registerSchema.safeParse({
        name: 'João Silva',
        email: 'j@t.com',
        password: '123',
        phone: '11999999999',
        cpf: '12345678901',
      });
      expect(result.success).toBe(false);
    });

    it('normalizes phone and cpf to digits', () => {
      const result = registerSchema.safeParse({
        name: 'João Silva',
        email: 'j@t.com',
        password: 'senha1234',
        phone: '(11) 99999-9999',
        cpf: '123.456.789-01',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBe('11999999999');
        expect(result.data.cpf).toBe('12345678901');
      }
    });
  });

  describe('completeProfileSchema', () => {
    it('accepts valid phone and cpf', () => {
      const result = completeProfileSchema.safeParse({ phone: '11999999999', cpf: '12345678901' });
      expect(result.success).toBe(true);
    });

    it('rejects cpf with wrong length', () => {
      const result = completeProfileSchema.safeParse({ phone: '11999999999', cpf: '123' });
      expect(result.success).toBe(false);
    });
  });

  describe('createConsultationSchema', () => {
    it('accepts consultationType, durationMinutes and symptoms with min 10 chars', () => {
      const result = createConsultationSchema.safeParse({
        consultationType: 'medico_clinico',
        durationMinutes: 15,
        symptoms: 'Dor de cabeça há 3 dias',
      });
      expect(result.success).toBe(true);
    });

    it('rejects symptoms too short', () => {
      const result = createConsultationSchema.safeParse({
        consultationType: 'psicologo',
        durationMinutes: 10,
        symptoms: 'Dor',
      });
      expect(result.success).toBe(false);
    });
  });
});
