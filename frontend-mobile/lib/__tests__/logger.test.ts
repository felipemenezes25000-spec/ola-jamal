import { logger, logApiError } from '../logger';

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe('logger', () => {
  it('expõe trace, debug, info, warn, error, fatal', () => {
    expect(typeof logger.trace).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.fatal).toBe('function');
  });

  it('chama sem lançar', () => {
    expect(() => logger.info('api', 'test')).not.toThrow();
    expect(() => logger.warn('api', 'warn')).not.toThrow();
    expect(() => logger.error('auth', 'err')).not.toThrow();
  });

  it('exception chama log sem lançar', () => {
    const err = new Error('test');
    expect(() => logger.exception('api', err)).not.toThrow();
  });

  it('logApiError existe e pode ser chamado', () => {
    expect(() => logApiError(404, '/api/x', 'Not found')).not.toThrow();
  });
});
