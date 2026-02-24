import type { RequestResponseDto } from '../../types/database';
import { getUiModel, type Role } from './requestUiModel';

export type GuardAction = 'pay' | 'sign' | 'deliver';

export function isActionAllowed(request: RequestResponseDto, role: Role, action: GuardAction): boolean {
  const ui = getUiModel(request, role);
  if (action === 'pay') return ui.actions.canPay;
  if (action === 'sign') return ui.actions.canSign;
  if (action === 'deliver') return ui.actions.canDeliver;
  return false;
}

export function getBlockedActionMessage(request: RequestResponseDto, role: Role, action: GuardAction): string {
  const ui = getUiModel(request, role);
  if (action === 'pay') {
    const alreadyPaidPhases = ['waiting_doctor', 'ready_to_sign', 'signed', 'delivered', 'finished'];
    return alreadyPaidPhases.includes(ui.phase)
      ? 'Pagamento já foi realizado.'
      : 'Este pedido não está disponível para pagamento.';
  }
  if (action === 'sign') return ui.disabledReason || 'Este pedido não está pronto para assinatura.';
  if (action === 'deliver') return ui.disabledReason || 'Este pedido não está pronto para entrega.';
  return 'Ação indisponível para este pedido.';
}
