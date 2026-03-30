import {
  STATUS_LABELS_PT,
  STATUS_DISPLAY_LABELS_PT,
  getStatusLabelPt,
  DASHBOARD_STATS_LABELS,
} from '../statusLabels';

describe('statusLabels', () => {
  describe('STATUS_LABELS_PT', () => {
    it('contém labels para status canônicos', () => {
      expect(STATUS_LABELS_PT.submitted).toBe('Enviado');
      expect(STATUS_LABELS_PT.in_review).toBe('Em análise médica');
      expect(STATUS_LABELS_PT.approved_pending_payment).toBe('Aprovado');
      expect(STATUS_LABELS_PT.delivered).toBe('Entregue');
      expect(STATUS_LABELS_PT.rejected).toBe('Rejeitado');
      expect(STATUS_LABELS_PT.cancelled).toBe('Cancelado');
    });
  });

  describe('STATUS_DISPLAY_LABELS_PT', () => {
    it('sobrescreve submitted para "Na fila"', () => {
      expect(STATUS_DISPLAY_LABELS_PT.submitted).toBe('Na fila');
    });
    it('sobrescreve searching_doctor para "Na fila"', () => {
      expect(STATUS_DISPLAY_LABELS_PT.searching_doctor).toBe('Na fila');
    });
  });

  describe('getStatusLabelPt', () => {
    it('retorna label para status conhecido', () => {
      expect(getStatusLabelPt('submitted')).toBe('Enviado');
      expect(getStatusLabelPt('delivered')).toBe('Entregue');
    });
    it('retorna — para null/undefined/vazio', () => {
      expect(getStatusLabelPt(null)).toBe('—');
      expect(getStatusLabelPt(undefined)).toBe('—');
      expect(getStatusLabelPt('')).toBe('—');
    });
    it('retorna o próprio status para desconhecido', () => {
      expect(getStatusLabelPt('unknown_status')).toBe('unknown_status');
    });
  });

  describe('DASHBOARD_STATS_LABELS', () => {
    it('tem chaves esperadas (sem fluxo de pagamento)', () => {
      expect(DASHBOARD_STATS_LABELS.analyzing).toBe('Em análise médica');
      expect(DASHBOARD_STATS_LABELS.ready).toBe('Prontos');
    });
  });
});
