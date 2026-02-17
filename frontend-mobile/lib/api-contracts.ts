/**
 * API contract validation - validate payloads before HTTP calls.
 * Aligns with backend DTOs and FluentValidation.
 */

import { validate } from './validation/validate';
import {
  loginSchema,
  registerSchema,
  registerDoctorSchema,
  completeProfileSchema,
  forgotPasswordSchema,
  changePasswordSchema,
  createPrescriptionSchema,
  createConsultationSchema,
  createExamSchema,
  rejectRequestSchema,
  signRequestSchema,
  uploadCertificateSchema,
} from './validation/schemas';
import type {
  LoginInput,
  RegisterInput,
  RegisterDoctorInput,
  CompleteProfileInput,
  ChangePasswordInput,
  CreatePrescriptionInput,
  CreateConsultationInput,
  CreateExamInput,
} from './validation/schemas';

// Auth
export const validateLogin = (input: unknown) => validate(loginSchema, input) as ReturnType<typeof validate<LoginInput>>;
export const validateRegister = (input: unknown) => validate(registerSchema, input) as ReturnType<typeof validate<RegisterInput>>;
export const validateRegisterDoctor = (input: unknown) =>
  validate(registerDoctorSchema, input) as ReturnType<typeof validate<RegisterDoctorInput>>;
export const validateCompleteProfile = (input: unknown) =>
  validate(completeProfileSchema, input) as ReturnType<typeof validate<CompleteProfileInput>>;
export const validateForgotPassword = (input: unknown) => validate(forgotPasswordSchema, input);
export const validateChangePassword = (input: unknown) =>
  validate(changePasswordSchema, input) as ReturnType<typeof validate<ChangePasswordInput>>;

// Requests
export const validateCreatePrescription = (input: unknown) =>
  validate(createPrescriptionSchema, input) as ReturnType<typeof validate<CreatePrescriptionInput>>;
export const validateCreateConsultation = (input: unknown) =>
  validate(createConsultationSchema, input) as ReturnType<typeof validate<CreateConsultationInput>>;
export const validateCreateExam = (input: unknown) =>
  validate(createExamSchema, input) as ReturnType<typeof validate<CreateExamInput>>;
export const validateRejectRequest = (input: unknown) => validate(rejectRequestSchema, input);
export const validateSignRequest = (input: unknown) => validate(signRequestSchema, input);

// Certificates
export const validateUploadCertificate = (input: unknown) => validate(uploadCertificateSchema, input);
