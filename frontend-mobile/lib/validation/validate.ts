/**
 * Validation helpers - safeParse wrappers for forms.
 * Returns { success, data, errors } for easy consumption.
 */

import { ZodSchema, ZodError } from 'zod';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
  firstError?: string;
}

export function validate<T>(schema: ZodSchema<T>, input: unknown): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const err = result.error as ZodError;
  const errors: Record<string, string> = {};
  let firstError: string | undefined;
  const issues = 'issues' in err ? err.issues : (err as any).errors || [];
  issues.forEach((e: { path: (string | number)[]; message: string }) => {
    const path = (e.path?.join?.('.') || 'form') as string;
    const msg = e.message || '';
    errors[path] = msg;
    if (!firstError) firstError = msg;
  });
  return { success: false, errors, firstError };
}
