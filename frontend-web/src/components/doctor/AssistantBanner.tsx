/**
 * AssistantBanner — Componente web do assistente "Dra. Renova".
 * Exibe sugestões proativas baseadas no status do pedido atual.
 * Alinhado ao mobile: AssistantBanner + ConductSection + ObservationCard.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAssistantNextAction } from '@/services/doctor-api-consultation';
import { getMutedKeys, muteKey } from '@/lib/triagePersistence';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles, X, ChevronRight, Lightbulb, AlertTriangle,
  Stethoscope, FileText,
} from 'lucide-react';

interface AssistantSuggestion {
  id: string;
  type: 'info' | 'warning' | 'action' | 'observation';
  title: string;
  message: string;
  actionLabel?: string;
  actionRoute?: string;
}

interface AssistantBannerProps {
  requestId?: string;
  requestStatus?: string;
  requestType?: string;
  onNavigate?: (route: string) => void;
}

function getIcon(type: string) {
  switch (type) {
    case 'warning': return AlertTriangle;
    case 'action': return Stethoscope;
    case 'observation': return FileText;
    default: return Lightbulb;
  }
}

function getBannerStyle(type: string) {
  switch (type) {
    case 'warning':
      return 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30';
    case 'action':
      return 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30';
    default:
      return 'border-primary/20 bg-primary/[0.03] dark:border-primary/30';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSuggestions(data: any, requestId?: string): AssistantSuggestion[] {
  const items: AssistantSuggestion[] = [];
  if (data?.action) {
    items.push({
      id: `action-${data.action}`,
      type: 'action',
      title: data.title || 'Próximo passo',
      message: data.message || data.description || '',
      actionLabel: data.actionLabel,
      actionRoute: data.actionRoute,
    });
  }
  if (data?.observation) {
    items.push({
      id: `obs-${requestId}`,
      type: 'observation',
      title: 'Observação',
      message: data.observation,
    });
  }
  if (data?.warning) {
    items.push({
      id: `warn-${requestId}`,
      type: 'warning',
      title: 'Atenção',
      message: data.warning,
    });
  }
  return items;
}

export function AssistantBanner({ requestId, requestStatus, requestType, onNavigate }: AssistantBannerProps) {
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([]);
  const [mutedKeys, setMutedKeys] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!requestId && !requestStatus) return;
    let cancelled = false;
    getAssistantNextAction(requestId, requestStatus, requestType)
      .then((data) => { if (!cancelled) setSuggestions(extractSuggestions(data, requestId)); })
      .catch(() => { /* Silencioso — assistente é opcional */ });
    getMutedKeys().then((keys) => { if (!cancelled) setMutedKeys(keys); }).catch(() => {});
    return () => { cancelled = true; };
  }, [requestId, requestStatus, requestType]);

  const handleDismiss = async (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
    try { await muteKey(id); } catch { /* ignore */ }
  };

  const visible = suggestions.filter(
    (s) => !dismissed.has(s.id) && !mutedKeys.includes(s.id)
  );

  if (visible.length === 0) return null;

  return (
    <AnimatePresence>
      {visible.map((suggestion) => {
        const Icon = getIcon(suggestion.type);
        return (
          <motion.div
            key={suggestion.id}
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className={`shadow-sm border ${getBannerStyle(suggestion.type)}`}>
              <CardContent className="p-3 flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Dra. Renova · {suggestion.title}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{suggestion.message}</p>
                  {suggestion.actionLabel && suggestion.actionRoute && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1.5 h-7 px-2 text-xs gap-1 text-primary"
                      onClick={() => onNavigate?.(suggestion.actionRoute!)}
                    >
                      {suggestion.actionLabel}
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <button
                  onClick={() => handleDismiss(suggestion.id)}
                  className="p-1 rounded-lg hover:bg-muted transition-colors shrink-0"
                  aria-label="Dispensar"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}
