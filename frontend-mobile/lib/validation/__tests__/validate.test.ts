import { validate } from '../validate';
import { loginSchema } from '../schemas';

describe('validate', () => {
  it('returns success and data for valid input', () => {
    const result = validate(loginSchema, { email: 'u@t.com', password: 'x' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('u@t.com');
      expect('errors' in result).toBe(false);
    }
  });

  it('returns errors and firstError for invalid input', () => {
    const result = validate(loginSchema, { email: '', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toBeDefined();
      expect(result.firstError).toBeDefined();
      expect(typeof result.firstError).toBe('string');
    }
  });
});
