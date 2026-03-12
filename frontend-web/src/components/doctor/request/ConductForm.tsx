/**
 * ConductForm — Formulário de conduta/prontuário para consultas.
 * Alinhado ao mobile ConductForm: conduta editável + checkbox incluir no PDF.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { updateConduct } from '@/services/doctor-api-consultation';
import { toast } from 'sonner';
import { FileText, Loader2, Lightbulb } from 'lucide-react';

interface ConductFormProps {
  requestId: string;
  initialNotes: string;
  initialIncludeInPdf: boolean;
  aiSuggestion?: string | null;
  onSaved?: () => void;
  className?: string;
}

export function ConductForm({
  requestId,
  initialNotes,
  initialIncludeInPdf,
  aiSuggestion,
  onSaved,
  className,
}: ConductFormProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [includeInPdf, setIncludeInPdf] = useState(initialIncludeInPdf);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConduct(requestId, { conductNotes: notes, includeConductInPdf: includeInPdf });
      toast.success('Conduta salva');
      onSaved?.();
    } catch {
      toast.error('Erro ao salvar conduta');
    } finally {
      setSaving(false);
    }
  };

  const applyAiSuggestion = () => {
    if (!aiSuggestion?.trim()) return;
    setNotes((prev) => (prev.trim() ? `${prev}\n\n${aiSuggestion.trim()}` : aiSuggestion.trim()));
    toast.success('Sugestão da IA aplicada');
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" aria-hidden />
          Conduta / Prontuário
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div>
          <Label htmlFor="conduct-notes" className="text-sm">
            Registro clínico (Queixa, Evolução, Hipótese, Conduta)
          </Label>
          <Textarea
            id="conduct-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Queixa e duração: ...&#10;Evolução / Anamnese: ...&#10;Hipótese diagnóstica (CID): ...&#10;Conduta: ..."
            rows={6}
            className="mt-1.5"
          />
        </div>
        {aiSuggestion?.trim() && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" />
              Sugestão da IA
            </p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-2 line-clamp-3">
              {aiSuggestion.slice(0, 200)}
              {aiSuggestion.length > 200 ? '...' : ''}
            </p>
            <Button variant="outline" size="sm" onClick={applyAiSuggestion}>
              Aplicar sugestão
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="include-conduct-pdf"
            checked={includeInPdf}
            onChange={(e) => setIncludeInPdf(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="include-conduct-pdf" className="text-sm font-normal cursor-pointer">
            Incluir conduta no PDF do documento assinado
          </Label>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar conduta
        </Button>
      </CardContent>
    </Card>
  );
}
