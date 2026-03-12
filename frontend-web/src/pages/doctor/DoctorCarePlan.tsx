/**
 * DoctorCarePlan — Plano de cuidados (acesso por ID).
 * Alinhado ao mobile care-plans/[carePlanId].
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  getCarePlan,
  reviewCarePlan,
  type CarePlan,
  type CarePlanTask,
} from '@/services/doctor-api-care-plans';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, ClipboardList, CheckCircle2 } from 'lucide-react';

function formatStatus(s: string): string {
  return s.replace(/_/g, ' ');
}

function formatType(s: string): string {
  return s.replace(/_/g, ' ');
}

export default function DoctorCarePlan() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [carePlan, setCarePlan] = useState<CarePlan | null>(null);

  useEffect(() => {
    if (!id) return;
    getCarePlan(id)
      .then(setCarePlan)
      .catch(() => {
        toast.error('Não foi possível carregar o plano');
        navigate('/consultas');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleReviewAndClose = async () => {
    if (!carePlan) return;
    setSaving(true);
    try {
      const decisions = carePlan.tasks
        .filter((t) => t.state === 'submitted')
        .map((t) => ({ taskId: t.id, decision: 'reviewed' }));
      const updated = await reviewCarePlan(carePlan.id, {
        closePlan: true,
        notes: 'Revisão concluída pelo médico responsável.',
        taskDecisions: decisions.length > 0 ? decisions : carePlan.tasks.map((t) => ({ taskId: t.id, decision: t.state === 'submitted' ? 'reviewed' : 'closed' })),
      });
      setCarePlan(updated);
      toast.success('Plano revisado e encerrado');
    } catch {
      toast.error('Erro ao encerrar plano');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DoctorLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Carregando plano...</p>
        </div>
      </DoctorLayout>
    );
  }

  if (!carePlan) {
    return (
      <DoctorLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Plano não encontrado</p>
          <Button variant="ghost" onClick={() => navigate('/consultas')} className="mt-4">
            Voltar às consultas
          </Button>
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Plano de cuidados</h1>
            <p className="text-sm text-muted-foreground">
              Status: {formatStatus(carePlan.status)}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {carePlan.tasks.map((task: CarePlanTask) => (
            <Card key={task.id} className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
                  {task.title}
                </CardTitle>
                <p className="text-xs text-muted-foreground capitalize">
                  {formatType(task.type)} • {formatStatus(task.state)}
                </p>
              </CardHeader>
              {task.description && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                  {task.files?.length > 0 && (
                    <p className="text-xs text-emerald-600 mt-2 font-medium">
                      Arquivos enviados: {task.files.length}
                    </p>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {carePlan.status === 'ready_for_review' && (
          <Button
            onClick={handleReviewAndClose}
            disabled={saving}
            className="w-full gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Revisar e encerrar plano
          </Button>
        )}
      </div>
    </DoctorLayout>
  );
}
