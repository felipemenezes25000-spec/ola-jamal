import { useEffect, useRef } from 'react';
import { useRequestsEvents } from '../contexts/RequestsEventsContext';

/**
 * Quando o backend envia um evento RequestUpdated para o requestId informado (ex.: documento assinado, consulta iniciada),
 * chama onUpdated para a tela poder refazer o fetch e atualizar a UI sem o usuário dar refresh.
 */
export function useRequestUpdated(requestId: string | undefined, onUpdated: () => void): void {
  const { subscribe } = useRequestsEvents();
  const onUpdatedRef = useRef(onUpdated);
  onUpdatedRef.current = onUpdated;

  useEffect(() => {
    if (!requestId) return;
    const unsubscribe = subscribe((payload) => {
      if (payload.requestId === requestId) {
        onUpdatedRef.current();
      }
    });
    return unsubscribe;
  }, [requestId, subscribe]);
}
