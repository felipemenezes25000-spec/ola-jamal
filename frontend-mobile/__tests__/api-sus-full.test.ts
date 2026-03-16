/**
 * api-sus-full.test.ts
 * Cobertura: lib/api-sus/index.ts (0% → ~90%)
 *
 * Testa todas as 20+ funções exportadas: unidades, cidadãos,
 * profissionais, agenda (lifecycle completo), atendimentos, relatórios, exportação.
 */

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();

jest.mock('../lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
}));

import * as sus from '../lib/api-sus';

// ── fixtures ────────────────────────────────────────────────────────────────

const UNIDADE = { id: 'u1', nome: 'UBS Saúde da Família', cnes: '1234567' };
const CIDADAO = { id: 'c1', nome: 'Maria Silva', cpf: '111.222.333-44', cns: '700000000000005' };
const PROFISSIONAL = { id: 'p1', nome: 'Dr. João', crm: '123456', cbo: '225125' };
const AGENDA = { id: 'ag1', cidadaoId: 'c1', profissionalId: 'p1', status: 'agendado' };
const ATENDIMENTO = { id: 'at1', cidadaoId: 'c1', tipo: 'consulta', dataHora: '2026-01-01T09:00:00Z' };

beforeEach(() => jest.clearAllMocks());

// ── Unidades de Saúde ─────────────────────────────────────────────────────

describe('sus — unidades', () => {
  it('fetchUnidades faz GET /api/sus/unidades', async () => {
    mockGet.mockResolvedValueOnce([UNIDADE]);
    await sus.fetchUnidades();
    expect(mockGet).toHaveBeenCalledWith('/api/sus/unidades');
  });

  it('fetchUnidade faz GET com ID correto', async () => {
    mockGet.mockResolvedValueOnce(UNIDADE);
    await sus.fetchUnidade('u1');
    expect(mockGet).toHaveBeenCalledWith('/api/sus/unidades/u1');
  });

  it('createUnidade faz POST com dados corretos', async () => {
    mockPost.mockResolvedValueOnce(UNIDADE);
    await sus.createUnidade({ nome: 'UBS Nova', cnes: '9999999' });
    expect(mockPost).toHaveBeenCalledWith(
      '/api/sus/unidades',
      expect.objectContaining({ nome: 'UBS Nova' })
    );
  });

  it('propaga erro de rede em fetchUnidades', async () => {
    mockGet.mockRejectedValueOnce(new Error('network'));
    await expect(sus.fetchUnidades()).rejects.toThrow('network');
  });
});

// ── Cidadãos ──────────────────────────────────────────────────────────────

describe('sus — cidadãos', () => {
  it('fetchCidadaos faz GET sem parâmetros', async () => {
    mockGet.mockResolvedValueOnce([CIDADAO]);
    await sus.fetchCidadaos();
    expect(mockGet).toHaveBeenCalledWith('/api/sus/cidadaos');
  });

  it('fetchCidadaos inclui search na query string', async () => {
    mockGet.mockResolvedValueOnce([CIDADAO]);
    await sus.fetchCidadaos('Maria');
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('search=Maria');
  });

  it('fetchCidadaos inclui unidadeId na query string', async () => {
    mockGet.mockResolvedValueOnce([CIDADAO]);
    await sus.fetchCidadaos(undefined, 'u1');
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('unidadeId=u1');
  });

  it('fetchCidadaos inclui ambos os parâmetros quando fornecidos', async () => {
    mockGet.mockResolvedValueOnce([CIDADAO]);
    await sus.fetchCidadaos('João', 'u2');
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('search=Jo');
    expect(url).toContain('unidadeId=u2');
  });

  it('fetchCidadao faz GET com ID', async () => {
    mockGet.mockResolvedValueOnce(CIDADAO);
    await sus.fetchCidadao('c1');
    expect(mockGet).toHaveBeenCalledWith('/api/sus/cidadaos/c1');
  });

  it('createCidadao faz POST', async () => {
    mockPost.mockResolvedValueOnce(CIDADAO);
    await sus.createCidadao({ nomeCompleto: 'Ana', cpf: '000.000.000-00' });
    expect(mockPost).toHaveBeenCalledWith('/api/sus/cidadaos', expect.any(Object));
  });

  it('updateCidadao faz PUT com ID e dados', async () => {
    mockPut.mockResolvedValueOnce(CIDADAO);
    await sus.updateCidadao('c1', { nomeCompleto: 'Ana Silva' });
    expect(mockPut).toHaveBeenCalledWith(
      '/api/sus/cidadaos/c1',
      expect.objectContaining({ nomeCompleto: 'Ana Silva' })
    );
  });

  it('searchCidadaoByCpf faz GET com CPF no path', async () => {
    mockGet.mockResolvedValueOnce(CIDADAO);
    await sus.searchCidadaoByCpf('111.222.333-44');
    expect(mockGet).toHaveBeenCalledWith('/api/sus/cidadaos/cpf/111.222.333-44');
  });

  it('searchCidadaoByCpf retorna null quando não encontrado', async () => {
    mockGet.mockResolvedValueOnce(null);
    const result = await sus.searchCidadaoByCpf('000.000.000-00');
    expect(result).toBeNull();
  });
});

// ── Profissionais ─────────────────────────────────────────────────────────

describe('sus — profissionais', () => {
  it('fetchProfissionais sem filtro faz GET /api/sus/profissionais', async () => {
    mockGet.mockResolvedValueOnce([PROFISSIONAL]);
    await sus.fetchProfissionais();
    expect(mockGet).toHaveBeenCalledWith('/api/sus/profissionais');
  });

  it('fetchProfissionais com unidadeId inclui query string', async () => {
    mockGet.mockResolvedValueOnce([PROFISSIONAL]);
    await sus.fetchProfissionais('u1');
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('unidadeId=u1');
  });

  it('createProfissional faz POST', async () => {
    mockPost.mockResolvedValueOnce(PROFISSIONAL);
    await sus.createProfissional({ nomeCompleto: 'Dra. Ana', conselhoNumero: '654321', cbo: '225125' });
    expect(mockPost).toHaveBeenCalledWith('/api/sus/profissionais', expect.any(Object));
  });
});

// ── Agenda ────────────────────────────────────────────────────────────────

describe('sus — agenda', () => {
  it('fetchAgendaDia faz GET com unidadeId e data', async () => {
    mockGet.mockResolvedValueOnce([AGENDA]);
    await sus.fetchAgendaDia('u1', '2026-01-01');
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('unidadeId=u1');
    expect(url).toContain('data=2026-01-01');
  });

  it('createAgenda faz POST com dados completos', async () => {
    mockPost.mockResolvedValueOnce(AGENDA);
    await sus.createAgenda({
      cidadaoId: 'c1', profissionalId: 'p1', unidadeSaudeId: 'u1',
      dataHora: '2026-01-01T09:00:00Z', tipoAtendimento: 'consulta',
    });
    expect(mockPost).toHaveBeenCalledWith('/api/sus/agenda', expect.any(Object));
  });

  it('agendaCheckIn faz POST no endpoint correto', async () => {
    mockPost.mockResolvedValueOnce({ ...AGENDA, status: 'check_in' });
    await sus.agendaCheckIn('ag1');
    expect(mockPost).toHaveBeenCalledWith('/api/sus/agenda/ag1/checkin');
  });

  it('agendaChamar faz POST no endpoint correto', async () => {
    mockPost.mockResolvedValueOnce({ ...AGENDA, status: 'chamado' });
    await sus.agendaChamar('ag1');
    expect(mockPost).toHaveBeenCalledWith('/api/sus/agenda/ag1/chamar');
  });

  it('agendaIniciar faz POST no endpoint correto', async () => {
    mockPost.mockResolvedValueOnce({ ...AGENDA, status: 'em_atendimento' });
    await sus.agendaIniciar('ag1');
    expect(mockPost).toHaveBeenCalledWith('/api/sus/agenda/ag1/iniciar');
  });

  it('agendaFinalizar faz POST no endpoint correto', async () => {
    mockPost.mockResolvedValueOnce({ ...AGENDA, status: 'finalizado' });
    await sus.agendaFinalizar('ag1');
    expect(mockPost).toHaveBeenCalledWith('/api/sus/agenda/ag1/finalizar');
  });
});

// ── Atendimentos ──────────────────────────────────────────────────────────

describe('sus — atendimentos', () => {
  it('fetchAtendimentos com unidadeId obrigatório', async () => {
    mockGet.mockResolvedValueOnce([ATENDIMENTO]);
    await sus.fetchAtendimentos('u1');
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('unidadeId=u1');
  });

  it('fetchAtendimentos inclui dataInicio e dataFim quando fornecidos', async () => {
    mockGet.mockResolvedValueOnce([ATENDIMENTO]);
    await sus.fetchAtendimentos('u1', '2026-01-01', '2026-01-31');
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('dataInicio=2026-01-01');
    expect(url).toContain('dataFim=2026-01-31');
  });

  it('fetchAtendimento faz GET por ID', async () => {
    mockGet.mockResolvedValueOnce(ATENDIMENTO);
    await sus.fetchAtendimento('at1');
    expect(mockGet).toHaveBeenCalledWith('/api/sus/atendimentos/at1');
  });

  it('createAtendimento faz POST', async () => {
    mockPost.mockResolvedValueOnce(ATENDIMENTO);
    await sus.createAtendimento({ cidadaoId: 'c1', tipo: 'consulta' });
    expect(mockPost).toHaveBeenCalledWith('/api/sus/atendimentos', expect.any(Object));
  });

  it('fetchAtendimentosCidadao faz GET com cidadaoId no path', async () => {
    mockGet.mockResolvedValueOnce([ATENDIMENTO]);
    await sus.fetchAtendimentosCidadao('c1');
    expect(mockGet).toHaveBeenCalledWith('/api/sus/atendimentos/cidadao/c1');
  });
});

// ── Relatórios ────────────────────────────────────────────────────────────

describe('sus — relatórios', () => {
  it('fetchRelatorioProducao sem filtros faz GET sem params extras', async () => {
    mockGet.mockResolvedValueOnce({ total: 0 });
    await sus.fetchRelatorioProducao();
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('/api/sus/relatorios/producao');
  });

  it('fetchRelatorioProducao com todos os filtros monta query correta', async () => {
    mockGet.mockResolvedValueOnce({ total: 42 });
    await sus.fetchRelatorioProducao('u1', '2026-01-01', '2026-01-31');
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('unidadeId=u1');
    expect(url).toContain('dataInicio=2026-01-01');
    expect(url).toContain('dataFim=2026-01-31');
  });
});

// ── Exportação ────────────────────────────────────────────────────────────

describe('sus — exportação e-SUS', () => {
  it('fetchExportacaoStatus faz GET no endpoint correto', async () => {
    mockGet.mockResolvedValueOnce({ status: 'idle', ultimaExportacao: null });
    await sus.fetchExportacaoStatus();
    expect(mockGet).toHaveBeenCalledWith('/api/sus/exportacao/status');
  });

  it('executarExportacao faz POST sem body e retorna contadores', async () => {
    mockPost.mockResolvedValueOnce({ exportados: 10, erros: 0 });
    const result = await sus.executarExportacao();
    expect(mockPost).toHaveBeenCalledWith('/api/sus/exportacao/executar');
    expect(result).toEqual({ exportados: 10, erros: 0 });
  });

  it('executarExportacao propaga erro do servidor', async () => {
    mockPost.mockRejectedValueOnce(new Error('exportação falhou'));
    await expect(sus.executarExportacao()).rejects.toThrow('exportação falhou');
  });
});
