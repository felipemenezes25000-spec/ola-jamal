export { evaluateTriageRules } from './triageRulesEngine';
export { canShow, markShown, muteKey, unmuteKey, resetSessionCounts, clearAll, getMutedKeys } from './triagePersistence';
export type { TriageContext, TriageStep, Severity, AvatarState, CTAAction, TriageMessage, TriageInput, TriagePersistedState } from './triage.types';
