import type { RequestResponseDto } from '../../../types/database';
import { isActionAllowed, getBlockedActionMessage } from '../requestGuards';

const mockGetUiModel = jest.fn();
jest.mock('../requestUiModel', () => ({
  getUiModel: (req: RequestResponseDto, role: string) => mockGetUiModel(req, role),
}));

const baseRequest = { id: 'req-1', status: 'submitted' } as RequestResponseDto;

describe('requestGuards', () => {
  beforeEach(() => mockGetUiModel.mockReset());

  describe('isActionAllowed', () => {
    it('sign: usa canSign', () => {
      mockGetUiModel.mockReturnValue({ actions: { canSign: true, canDeliver: false } });
      expect(isActionAllowed(baseRequest, 'doctor', 'sign')).toBe(true);
    });
    it('deliver: usa canDeliver', () => {
      mockGetUiModel.mockReturnValue({ actions: { canSign: false, canDeliver: true } });
      expect(isActionAllowed(baseRequest, 'doctor', 'deliver')).toBe(true);
    });
  });

  describe('getBlockedActionMessage', () => {
    it('sign: retorna disabledReason ou fallback', () => {
      mockGetUiModel.mockReturnValue({ disabledReason: 'Aguardando aprovação', actions: {} });
      expect(getBlockedActionMessage(baseRequest, 'doctor', 'sign')).toBe('Aguardando aprovação');
      mockGetUiModel.mockReturnValue({ disabledReason: undefined, actions: {} });
      expect(getBlockedActionMessage(baseRequest, 'doctor', 'sign')).toBe(
        'Este pedido não está pronto para assinatura.'
      );
    });
    it('deliver: retorna disabledReason ou fallback', () => {
      mockGetUiModel.mockReturnValue({ disabledReason: undefined, actions: {} });
      expect(getBlockedActionMessage(baseRequest, 'doctor', 'deliver')).toBe(
        'Este pedido não está pronto para entrega.'
      );
    });
  });
});
