import { validate } from '../validate';
import { loginSchema } from '../schemas';

describe('validate', () => {
  it('returns success and data for valid input', () => {
    const result = validate(loginSchema, { email: 'u@t.com', password: 'x' });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe('u@t.com');
    expect(result.errors).toBeUndefined();
  });

  it('returns errors and firstError for invalid input', () => {
    const result = validate(loginSchema, { email: '', password: '' });
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.errors).toBeDefined();
    expect(result.firstError).toBeDefined();
    expect(typeof result.firstError).toBe('string');
  });
});
