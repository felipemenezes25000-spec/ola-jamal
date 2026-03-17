/**
 * PatientSidePanel — Prontuário resumido do paciente para split-view no desktop.
 * Mostra: dados básicos, alergias, condições crônicas, resumo narrativo,
 * problemas ativos, últimas notas clínicas e atendimentos.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getPatientProfile,
  getPatientClinicalSummary,
  getPatientRequests,
  type PatientProfile,
  type PatientClinicalSummaryResponse,
  type MedicalRequest,
  DOCTOR_NOTE_TYPES,
} from '@/services/doctorApi';
import { parseApiList, getTypeIcon, getTypeLabel } from '@/lib/doctor-helpers';
import {
  User,
  Calendar,
  Phone,
  Mail,
  AlertTriangle,
  Heart,
  FileText,
  Stethoscope,
  StickyNote,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from 'lucide-react';

function getNoteTypeLabel(key: string): string {
  const found = DOCTOR_NOTE_TYPES.find((t) => t.key === key);
  return found?.label ?? key;
}

export interface PatientSidePanelProps {
  patientId: string | null | undefined;
  currentRequestId?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function PatientSidePanel({
  patientId,
  currentRequestId,
  collapsed = false,
  onCollapsedChange,
}: PatientSidePanelProps) {
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [summary, setSummary] = useState<PatientClinicalSummaryResponse | null>(null);
  const [requests, setRequests] = useState<MedicalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!patientId) return;
    queueMicrotask(() => setLoading(true));
    Promise.all([
      getPatientProfile(patientId),
      getPatientClinicalSummary(patientId).catch(() => null),
      getPatientRequests(patientId).catch(() => []),
    ])
      .then(([p, s, r]) => {
        setPatient(p);
        setSummary(s);
        setRequests(parseApiList<MedicalRequest>(r));
      })
      .catch(() => setPatient(null))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (!patientId) return null;

  const allergies = patient?.allergies ?? [];
  const chronicConditions = patient?.chronicConditions ?? [];
  const narrativeSummary = summary?.structured?.narrativeSummary ?? summary?.summary ?? summary?.fallback;
  const problemList = summary?.structured?.problemList ?? [];
  const doctorNotes = (summary?.doctorNotes ?? []).slice(0, 5);
  const lastRequests = [...requests]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .filter((r) => r.id !== currentRequestId);

  const age = patient?.birthDate
    ? Math.floor(
        (now - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
      )
    : null;

  if (collapsed) {
    return (
      <div className="hidden lg:flex flex-col items-center py-4 border-l border-border bg-muted/30 min-w-[48px] shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCollapsedChange?.(false)}
          aria-label="Expandir prontuário"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-[10px] text-muted-foreground mt-2 [writing-mode:vertical-rl] rotate-180">
          Prontuário
        </span>
      </div>
    );
  }

  return (
    <aside className="hidden lg:flex lg:w-[40%] lg:min-w-[320px] flex-col shrink-0">
      <div className="sticky top-0 max-h-screen overflow-y-auto border-l border-border bg-muted/20">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/95">
          <span className="text-sm font-semibold">Prontuário do Paciente</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onCollapsedChange?.(true)}
            aria-label="Recolher prontuário"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Dados básicos */}
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                      {patient?.avatarUrl ? (
                        <img src={patient.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{patient?.name ?? '—'}</p>
                      {patient?.email && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Mail className="h-3 w-3 shrink-0" /> {patient.email}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                        {patient?.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {patient.phone}
                          </span>
                        )}
                        {age != null && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {age} anos
                          </span>
                        )}
                        {patient?.gender && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />{' '}
                            {patient.gender === 'male' ? 'M' : patient.gender === 'female' ? 'F' : patient.gender}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Alergias e condições crônicas */}
              {(allergies.length > 0 || chronicConditions.length > 0) && (
                <div className="space-y-2">
                  {allergies.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mb-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> Alergias
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {allergies.map((a, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                            {a}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {chronicConditions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-600 flex items-center gap-1 mb-1.5">
                        <Heart className="h-3.5 w-3.5" /> Condições crônicas
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {chronicConditions.map((c, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-200">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Resumo narrativo */}
              {narrativeSummary && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      Resumo clínico
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-6">
                      {narrativeSummary}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Problemas ativos */}
              {problemList.length > 0 && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Stethoscope className="h-3.5 w-3.5 text-primary" />
                      Problemas ativos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-1">
                      {problemList.slice(0, 8).map((p, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Últimas 5 notas clínicas */}
              {doctorNotes.length > 0 && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <StickyNote className="h-3.5 w-3.5 text-primary" />
                      Notas clínicas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {doctorNotes.map((n) => (
                      <div key={n.id} className="p-2 rounded-lg bg-muted/50 border border-border/50">
                        <p className="text-[10px] font-semibold text-primary uppercase">
                          {getNoteTypeLabel(n.noteType)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.content}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(n.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Últimos 5 atendimentos */}
              {lastRequests.length > 0 && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      Atendimentos recentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      {lastRequests.map((r) => {
                        const Icon = getTypeIcon(r.type);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => navigate(`/pedidos/${r.id}`)}
                            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                          >
                            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs flex-1 truncate">
                              {getTypeLabel(r.type)} ·{' '}
                              {new Date(r.createdAt).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1"
                onClick={() => navigate(`/paciente/${patientId}`)}
              >
                Ver prontuário completo
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
