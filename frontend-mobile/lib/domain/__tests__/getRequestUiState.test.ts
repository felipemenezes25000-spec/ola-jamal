import {
  getRequestUiState,
  isPendingForPanel,
  countNaFila,
  countConsultaPronta,
  countEmConsulta,
  countPendentes,
  getPendingForPanel,
  isHistorical,
  getHistoricalGroupedByDay,
  getHistoricalGroupedByPeriod,
  isSignedOrDelivered,
  getRequestUiState as mapUi,
} from '../getRequestUiState';

type Req = any;

const req = (status: string, extra: Partial<Req> = {}): Req => ({
  id: `id-${status}`,
  status,
  createdAt: '2026-03-01T12:00:00Z',
  updatedAt: '2026-03-01T12:00:00Z',
  ...extra,
});

describe('getRequestUiState', () => {
  it('mapeia status canônicos corretamente', () => {
    expect(mapUi(req('submitted')).uiState).toBe('needs_action');
    expect(mapUi(req('approved_pending_payment')).uiState).toBe('needs_action');
    expect(mapUi(req('in_consultation')).uiState).toBe('in_consultation');
    expect(mapUi(req('consultation_ready')).uiState).toBe('ready');
    expect(mapUi(req('consultation_finished')).uiState).toBe('historical');
  });

  it('mapeia legados corretamente', () => {
    expect(mapUi(req('pending')).uiState).toBe('needs_action');
    expect(mapUi(req('pending_payment')).uiState).toBe('needs_action');
    expect(mapUi(req('completed')).uiState).toBe('historical');
  });

  it('status desconhecido cai em historical', () => {
    const result = mapUi(req('desconhecido_total'));
    expect(result.uiState).toBe('historical');
    expect(result.colorKey).toBe('historical');
  });

  it('retorna label e colorKey consistentes', () => {
    const paid = mapUi(req('paid'));
    expect(paid.label).toBeTruthy();
    expect(['action', 'success', 'waiting', 'historical']).toContain(paid.colorKey);
  });

  it('paid + consultation retorna "Consulta pronta"', () => {
    const res = mapUi(req('paid', { requestType: 'consultation' }));
    expect(res.uiState).toBe('ready');
    expect(res.label).toBe('Consulta pronta');
  });

  it('paid + prescription retorna needs_action', () => {
    const res = mapUi(req('paid', { requestType: 'prescription' }));
    expect(res.uiState).toBe('needs_action');
  });
});

describe('painel de pendências', () => {
  const requests = [
    req('submitted'),
    req('in_review'),
    req('approved_pending_payment'),
    req('paid', { requestType: 'consultation' }), // consulta paga = "Consulta pronta"
    req('in_consultation'),
    req('delivered'),
    req('cancelled'),
  ];

  it('isPendingForPanel reconhece pendentes', () => {
    expect(isPendingForPanel(req('submitted'))).toBe(true);
    expect(isPendingForPanel(req('paid'))).toBe(true);
    expect(isPendingForPanel(req('in_consultation'))).toBe(true);
    expect(isPendingForPanel(req('delivered'))).toBe(false);
  });

  it('countNaFila conta apenas fila', () => {
    expect(countNaFila(requests)).toBe(3);
  });

  it('countConsultaPronta conta paid', () => {
    expect(countConsultaPronta(requests)).toBe(1);
  });

  it('countEmConsulta conta in_consultation', () => {
    expect(countEmConsulta(requests)).toBe(1);
  });

  it('countPendentes soma os que exigem ação', () => {
    expect(countPendentes(requests)).toBe(5);
  });

  it('getPendingForPanel respeita limite', () => {
    const top2 = getPendingForPanel(requests, 2);
    expect(top2).toHaveLength(2);
    expect(top2.every(isPendingForPanel)).toBe(true);
  });
});

describe('histórico e agrupamentos', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-06T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('isHistorical detecta finalizados', () => {
    expect(isHistorical(req('signed'))).toBe(true);
    expect(isHistorical(req('delivered'))).toBe(true);
    expect(isHistorical(req('submitted'))).toBe(false);
  });

  it('getHistoricalGroupedByDay agrupa por data e limita dias', () => {
    const list = [
      req('signed', { updatedAt: '2026-03-06T10:00:00Z' }),
      req('delivered', { updatedAt: '2026-03-06T11:00:00Z' }),
      req('consultation_finished', { updatedAt: '2026-03-05T11:00:00Z' }),
      req('cancelled', { updatedAt: '2026-03-04T11:00:00Z' }),
    ];

    const grouped = getHistoricalGroupedByDay(list, 2);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].dateKey).toBe('2026-03-06');
    expect(grouped[0].count).toBe(2);
  });

  it('ignora datas inválidas no agrupamento', () => {
    const list = [req('signed', { updatedAt: 'data-invalida' }), req('delivered')];
    const grouped = getHistoricalGroupedByDay(list, 7);
    expect(grouped.length).toBeGreaterThanOrEqual(1);
  });

  it('getHistoricalGroupedByPeriod retorna métricas esperadas', () => {
    const list = [
      req('signed', { updatedAt: '2026-03-05T12:00:00Z' }),
      req('delivered', { updatedAt: '2026-02-20T12:00:00Z' }),
      req('consultation_finished', { updatedAt: '2025-12-20T12:00:00Z' }),
      req('submitted', { updatedAt: '2026-03-05T12:00:00Z' }), // não histórico
    ];

    const periods = getHistoricalGroupedByPeriod(list);
    expect(periods.map((p) => p.label)).toEqual(['Semana', 'Mês', '3 meses', '6 meses']);
    expect(periods[0].count).toBeGreaterThanOrEqual(1);
    expect(periods[3].count).toBeGreaterThanOrEqual(periods[2].count);
  });
});

describe('helpers finais', () => {
  it('isSignedOrDelivered reconhece finalização', () => {
    expect(isSignedOrDelivered(req('signed'))).toBe(true);
    expect(isSignedOrDelivered(req('delivered'))).toBe(true);
    expect(isSignedOrDelivered(req('consultation_finished'))).toBe(true);
    expect(isSignedOrDelivered(req('submitted'))).toBe(false);
  });

  it('aceita objeto parcial com status nulo/indefinido', () => {
    expect(getRequestUiState({ status: undefined }).uiState).toBe('historical');
    expect(getRequestUiState({ status: null }).uiState).toBe('historical');
  });
});
