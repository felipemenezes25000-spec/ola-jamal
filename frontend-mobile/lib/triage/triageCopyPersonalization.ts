import type { TriageInput, TriageMessage } from './triage.types';

type CopyProfile = 'objective' | 'supportive' | 'guided';

type AbVariant = 'A' | 'B';

function detectProfile(input: TriageInput): CopyProfile {
  if ((input.patientAge ?? 0) >= 60) return 'guided';
  if ((input.symptoms?.length ?? 0) > 120 || input.status === 'rejected') return 'supportive';
  return 'objective';
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pickVariant(input: TriageInput, message: TriageMessage): AbVariant {
  const seed = `${input.requestId ?? 'na'}:${input.context}:${message.key}`;
  return hashSeed(seed) % 2 === 0 ? 'A' : 'B';
}

function adaptByProfile(profile: CopyProfile, text: string): string {
  if (profile === 'objective') return text;
  if (profile === 'supportive') return `Estou com você. ${text}`;
  return `Passo a passo: ${text}`;
}

function adaptByVariant(variant: AbVariant, text: string): string {
  if (variant === 'A') return text;
  // Variante B: mais humana e orientada à ação
  if (text.endsWith('.')) return `${text} Vamos resolver isso juntos.`;
  return `${text}. Vamos resolver isso juntos.`;
}

function adaptCtaLabel(variant: AbVariant, original?: string): string | undefined {
  if (!original) return original;
  if (variant === 'A') return original;
  if (original.toLowerCase().includes('pedido')) return 'Ver meu pedido agora';
  if (original.toLowerCase().includes('pagamento')) return 'Finalizar pagamento';
  if (original.toLowerCase().includes('documento')) return 'Abrir documento';
  return `Ir agora: ${original}`;
}

export function personalizeTriageCopy(message: TriageMessage, input: TriageInput): TriageMessage {
  const profile = detectProfile(input);
  const variant = pickVariant(input, message);

  const textProfile = adaptByProfile(profile, message.text);
  const text = adaptByVariant(variant, textProfile);

  return {
    ...message,
    text,
    ctaLabel: adaptCtaLabel(variant, message.ctaLabel),
    analyticsEvent: message.analyticsEvent
      ? `${message.analyticsEvent}.ab_${variant.toLowerCase()}.${profile}`
      : `triage.copy.ab_${variant.toLowerCase()}.${profile}`,
  };
}
