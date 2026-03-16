/**
 * api-contracts.test.ts — validação de contratos de API (Zod schemas)
 * Destino: frontend-mobile/__tests__/api-contracts.test.ts
 */

import {
  validateLogin,
  validateRegister,
  validateForgotPassword,
  validateChangePassword,
  validateCreatePrescription,
  validateCreateConsultation,
  validateCreateExam,
  validateRejectRequest,
  validateSignRequest,
  validateUploadCertificate,
} from '../lib/api-contracts';

// ─── Auth ─────────────────────────────────────────────────────────────────

describe('validateLogin', () => {
  it('aceita credenciais válidas', () => {
    const r = validateLogin({ email: 'medico@teste.com.br', password: 'Senha@123' });
    expect(r.success).toBe(true);
  });

  it('rejeita sem email', () => {
    const r = validateLogin({ password: 'Senha@123' });
    expect(r.success).toBe(false);
  });

  it('rejeita email inválido', () => {
    const r = validateLogin({ email: 'nao-e-email', password: 'Senha@123' });
    expect(r.success).toBe(false);
  });

  it('rejeita senha vazia', () => {
    const r = validateLogin({ email: 'a@b.com', password: '' });
    expect(r.success).toBe(false);
  });
});

describe('validateRegister', () => {
  const valid = {
    name: 'Maria Silva',
    email: 'maria@teste.com.br',
    password: 'Senha@123',
    cpf: '529.982.247-25',
    phone: '(11) 98765-4321',
    birthDate: '1985-03-15',
  };

  it('aceita payload válido', () => {
    expect(validateRegister(valid).success).toBe(true);
  });

  it('rejeita sem nome', () => {
    expect(validateRegister({ ...valid, name: '' }).success).toBe(false);
  });

  it('rejeita CPF em branco', () => {
    expect(validateRegister({ ...valid, cpf: '' }).success).toBe(false);
  });
});

describe('validateForgotPassword', () => {
  it('aceita email válido', () => {
    expect(validateForgotPassword({ email: 'a@b.com.br' }).success).toBe(true);
  });

  it('rejeita email inválido', () => {
    expect(validateForgotPassword({ email: 'invalido' }).success).toBe(false);
  });
});

describe('validateChangePassword', () => {
  it('aceita quando senhas coincidem', () => {
    const r = validateChangePassword({
      currentPassword: 'Antiga@1',
      newPassword: 'Nova@1234',
      confirmPassword: 'Nova@1234',
    });
    expect(r.success).toBe(true);
  });

  it('rejeita quando senhas não coincidem', () => {
    const r = validateChangePassword({
      currentPassword: 'Antiga@1',
      newPassword: 'Nova@1234',
      confirmPassword: 'Diferente@1',
    });
    expect(r.success).toBe(false);
  });
});

// ─── Requests ─────────────────────────────────────────────────────────────

describe('validateCreatePrescription', () => {
  const valid = {
    prescriptionType: 'receita_simples',
    symptoms: 'Dor de cabeça há 3 dias',
    prescriptionImages: ['base64data=='],
  };

  it('aceita payload válido', () => {
    expect(validateCreatePrescription(valid).success).toBe(true);
  });

  it('rejeita sem prescriptionType', () => {
    const { prescriptionType, ...rest } = valid;
    expect(validateCreatePrescription(rest).success).toBe(false);
  });

  it('rejeita sem symptoms', () => {
    const { symptoms, ...rest } = valid;
    expect(validateCreatePrescription(rest).success).toBe(false);
  });
});

describe('validateCreateExam', () => {
  const valid = {
    examType: 'laboratorial',
    symptoms: 'Cansaço persistente',
    prescriptionImages: [],
  };

  it('aceita payload válido', () => {
    expect(validateCreateExam(valid).success).toBe(true);
  });

  it('rejeita sem examType', () => {
    const { examType, ...rest } = valid;
    expect(validateCreateExam(rest).success).toBe(false);
  });
});

describe('validateCreateConsultation', () => {
  const valid = {
    symptoms: 'Febre há 2 dias',
    specialtyRequested: 'Clínica Geral',
  };

  it('aceita payload válido', () => {
    expect(validateCreateConsultation(valid).success).toBe(true);
  });

  it('rejeita sem symptoms', () => {
    const { symptoms, ...rest } = valid;
    expect(validateCreateConsultation(rest).success).toBe(false);
  });
});

describe('validateRejectRequest', () => {
  it('aceita motivo não vazio', () => {
    expect(validateRejectRequest({ reason: 'Informações insuficientes' }).success).toBe(true);
  });

  it('rejeita motivo vazio', () => {
    expect(validateRejectRequest({ reason: '' }).success).toBe(false);
  });

  it('rejeita sem motivo', () => {
    expect(validateRejectRequest({}).success).toBe(false);
  });
});

describe('validateSignRequest', () => {
  it('aceita requestId válido', () => {
    const r = validateSignRequest({ requestId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(r.success).toBe(true);
  });

  it('rejeita requestId vazio', () => {
    expect(validateSignRequest({ requestId: '' }).success).toBe(false);
  });
});

describe('validateUploadCertificate', () => {
  it('aceita dados de certificado', () => {
    const r = validateUploadCertificate({
      pfxBase64: 'base64data==',
      password: 'senha_cert',
    });
    expect(r.success).toBe(true);
  });

  it('rejeita sem pfxBase64', () => {
    expect(validateUploadCertificate({ password: 'senha' }).success).toBe(false);
  });
});
