import { humanizeError } from '../humanizeError';

describe('humanizeError', () => {
  it('retorna userMessagePtBr quando presente e não vazio', () => {
    expect(humanizeError({ userMessagePtBr: ' Mensagem custom ' })).toContain('Mensagem custom');
  });

  it('retorna mensagem por pattern quando message contém padrão', () => {
    expect(humanizeError(new Error('request not found'), 'request')).toBe('Pedido não encontrado.');
  });

  it('context request: mapeia padrões de pedido', () => {
    expect(humanizeError(new Error('cannot approve'), 'request')).toBe(
      'Não é possível aprovar este pedido no momento.'
    );
    expect(humanizeError(new Error('cannot sign'), 'request')).toBe(
      'Não é possível assinar este documento no momento.'
    );
  });

  it('context consultation: mapeia padrões de consulta', () => {
    expect(humanizeError(new Error('consultation not available'), 'consultation')).toBe(
      'Esta consulta não está disponível no momento.'
    );
    expect(humanizeError(new Error('already accepted'), 'consultation')).toBe('Esta consulta já foi aceita.');
  });

  it('retorna fallback quando mensagem vazia', () => {
    expect(humanizeError(null)).toBe('Ocorreu um erro inesperado. Tente novamente mais tarde.');
    expect(humanizeError({ message: '' })).toBe('Ocorreu um erro inesperado. Tente novamente mais tarde.');
    expect(humanizeError('')).toBe('Ocorreu um erro inesperado. Tente novamente mais tarde.');
  });

  it('Network/fetch vira mensagem de conexão', () => {
    expect(humanizeError(new Error('Network request failed'))).toBe(
      'Não foi possível conectar. Verifique sua internet e tente novamente.'
    );
    expect(humanizeError(new Error('Failed to fetch'))).toBe(
      'Não foi possível conectar. Verifique sua internet e tente novamente.'
    );
  });

  it('401/Unauthorized vira sessão expirada', () => {
    expect(humanizeError(new Error('401 Unauthorized'))).toBe('Sessão expirada. Faça login novamente.');
  });

  it('500/Internal Server Error vira erro no servidor', () => {
    expect(humanizeError(new Error('500 Internal Server Error'))).toBe(
      'Erro no servidor. Tente novamente em alguns instantes.'
    );
    expect(humanizeError(new Error('Ocorreu um erro ao processar sua solicitação'))).toBe(
      'Erro no servidor. Tente novamente em alguns instantes.'
    );
  });

  it('aceita string como erro', () => {
    expect(humanizeError('pedido não encontrado')).toBe('Pedido não encontrado.');
  });

  it('generic context usa todos os padrões', () => {
    expect(humanizeError(new Error('pedido não encontrado'))).toBe('Pedido não encontrado.');
  });
});
