/**
 * Validation helpers - safeParse wrappers for forms.
 * Returns discriminated union for type-safe narrowing.
 */

import { ZodType, ZodError } from 'zod';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string>; firstError?: string };

export function validate<T>(schema: ZodType<T>, input: unknown): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const err = result.error as ZodError;
  const errors: Record<string, string> = {};
  let firstError: string | undefined;
  const issues = 'issues' in err ? err.issues : (err as { errors?: { path?: unknown[]; message?: string }[] }).errors || [];
  for (const e of issues) {
    const pathArr = Array.isArray(e.path) ? e.path : [];
    const path = (pathArr.map(String).join('.') || 'form') as string;
    const msg = (e as { message?: string }).message || '';
    errors[path] = msg;
    if (!firstError) firstError = msg;
  }
  return { success: false, errors, firstError };
}
