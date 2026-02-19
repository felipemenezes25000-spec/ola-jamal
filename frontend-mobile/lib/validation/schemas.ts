/**
 * Zod schemas aligned with backend API contracts.
 * Mirrors FluentValidation rules from backend-dotnet.
 */

import { z } from 'zod';
import { digitsOnly, normalizeEmail, normalizeText } from './normalizers';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Backend validates specialty via MedicalSpecialtyDisplay; CrmState expects 2 chars (UF).

// --- Auth ---

export const loginSchema = z.object({
  email: z
    .string()
    .transform(normalizeEmail)
    .pipe(z.string().min(1, 'Email obrigatório').regex(EMAIL_REGEX, 'Email inválido')),
  password: z.string().min(1, 'Senha obrigatória'),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .transform(normalizeEmail)
    .pipe(z.string().min(1, 'Informe seu e-mail').regex(EMAIL_REGEX, 'Email inválido')),
});

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'Nova senha deve ter pelo menos 8 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

export const completeProfileSchema = z.object({
  phone: z
    .string()
    .transform((s) => digitsOnly(s))
    .pipe(
      z.string()
        .min(10, 'Telefone deve ter 10 ou 11 dígitos')
        .max(11, 'Telefone deve ter 10 ou 11 dígitos')
        .regex(/^\d{10,11}$/, 'Telefone deve conter apenas números')
    ),
  cpf: z
    .string()
    .transform((s) => digitsOnly(s))
    .pipe(
      z.string()
        .length(11, 'CPF deve ter 11 dígitos')
        .regex(/^\d{11}$/, 'CPF deve conter apenas números')
    ),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  complement: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2, 'UF deve ter 2 letras').optional(),
  postalCode: z.string().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Senha atual obrigatória'),
    newPassword: z.string().min(8, 'Nova senha deve ter pelo menos 8 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

const baseRegisterSchema = {
  name: z
    .string()
    .transform(normalizeText)
    .pipe(
      z.string()
        .min(1, 'Nome obrigatório')
        .max(200, 'Nome não pode exceder 200 caracteres')
        .refine((n) => n.split(/\s+/).filter(Boolean).length >= 2, 'Nome deve ter pelo menos 2 palavras')
    ),
  email: z
    .string()
    .transform(normalizeEmail)
    .pipe(z.string().min(1, 'Email obrigatório').regex(EMAIL_REGEX, 'Email inválido')),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  phone: z
    .string()
    .transform((s) => digitsOnly(s))
    .pipe(
      z.string()
        .min(10, 'Telefone deve ter 10 ou 11 dígitos')
        .max(11, 'Telefone deve ter 10 ou 11 dígitos')
        .regex(/^\d{10,11}$/, 'Telefone deve conter apenas números')
    ),
  cpf: z
    .string()
    .transform((s) => digitsOnly(s))
    .pipe(
      z.string()
        .length(11, 'CPF deve ter 11 dígitos')
        .regex(/^\d{11}$/, 'CPF deve conter apenas números')
    ),
};

export const registerSchema = z.object(baseRegisterSchema);

export const registerDoctorSchema = z.object({
  ...baseRegisterSchema,
  crm: z.string().transform(normalizeText).pipe(z.string().min(1, 'CRM obrigatório').max(20, 'CRM não pode exceder 20 caracteres')),
  crmState: z
    .string()
    .transform((s) => s.trim().toUpperCase().slice(0, 2))
    .pipe(z.string().length(2, 'Estado do CRM deve ter 2 letras (ex: SP)')),
  specialty: z.string().transform(normalizeText).pipe(z.string().min(1, 'Especialidade obrigatória')),
});

// --- Requests ---

export const prescriptionTypeSchema = z.enum(['simples', 'controlado', 'azul']);

export const createPrescriptionSchema = z.object({
  prescriptionType: prescriptionTypeSchema,
  medications: z.array(z.string()).optional().default([]),
});

export const createConsultationSchema = z.object({
  symptoms: z
    .string()
    .transform(normalizeText)
    .pipe(z.string().min(10, 'Descreva melhor seus sintomas (mínimo 10 caracteres)')),
});

export const createExamSchema = z
  .object({
    examType: z.string().optional(),
    exams: z.array(z.string()).optional().default([]),
    symptoms: z.string().transform(normalizeText).optional().default(''),
    images: z.array(z.string()).optional().default([]),
  })
  .refine(
    (d) =>
      (d.exams && d.exams.length > 0) ||
      (d.images && d.images.length > 0) ||
      (d.symptoms && d.symptoms.length > 0),
    { message: 'Informe pelo menos um exame, imagens ou sintomas/indicação.', path: ['exams'] }
  );

export const rejectRequestSchema = z.object({
  rejectionReason: z.string().transform(normalizeText).pipe(z.string().min(1, 'Informe o motivo da rejeição')),
});

export const signRequestSchema = z.object({
  certPassword: z.string().min(1, 'Digite a senha do certificado'),
});

// --- Certificates ---

export const uploadCertificateSchema = z.object({
  password: z.string().min(1, 'Informe a senha do certificado'),
});

// --- Helpers ---

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterDoctorInput = z.infer<typeof registerDoctorSchema>;
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type CreateExamInput = z.infer<typeof createExamSchema>;
