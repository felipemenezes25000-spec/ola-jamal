/**
 * TemplateDialog — Salvar ou usar templates de receita/exame.
 * Persistência em localStorage. Sem backend.
 */
import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export interface PrescriptionTemplate {
  name: string;
  medications: { name: string; dosage: string; frequency: string; duration: string; notes?: string }[];
  prescriptionKind: string;
  createdAt: string;
}

export interface ExamTemplate {
  name: string;
  exams: { name: string; notes?: string }[];
  createdAt: string;
}

const PRESCRIPTION_KEY = 'doctor_prescription_templates';
const EXAM_KEY = 'doctor_exam_templates';

function loadPrescriptionTemplates(): PrescriptionTemplate[] {
  try {
    const raw = localStorage.getItem(PRESCRIPTION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePrescriptionTemplates(templates: PrescriptionTemplate[]) {
  localStorage.setItem(PRESCRIPTION_KEY, JSON.stringify(templates));
}

function loadExamTemplates(): ExamTemplate[] {
  try {
    const raw = localStorage.getItem(EXAM_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveExamTemplates(templates: ExamTemplate[]) {
  localStorage.setItem(EXAM_KEY, JSON.stringify(templates));
}

// ── Save mode ──

export interface TemplateDialogSaveProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'prescription' | 'exam';
  prescriptionData?: {
    medications: PrescriptionTemplate['medications'];
    prescriptionKind: string;
  };
  examData?: ExamTemplate['exams'];
  onSaved?: () => void;
}

export function TemplateDialogSave({
  open,
  onOpenChange,
  mode,
  prescriptionData,
  examData,
  onSaved,
}: TemplateDialogSaveProps) {
  const [name, setName] = useState('');

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Informe o nome do template');
      return;
    }
    if (mode === 'prescription' && prescriptionData) {
      const templates = loadPrescriptionTemplates();
      templates.unshift({
        name: trimmed,
        medications: prescriptionData.medications,
        prescriptionKind: prescriptionData.prescriptionKind,
        createdAt: new Date().toISOString(),
      });
      savePrescriptionTemplates(templates);
      toast.success('Template salvo');
    } else if (mode === 'exam' && examData) {
      const templates = loadExamTemplates();
      templates.unshift({
        name: trimmed,
        exams: examData,
        createdAt: new Date().toISOString(),
      });
      saveExamTemplates(templates);
      toast.success('Template salvo');
    }
    setName('');
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar como template</DialogTitle>
          <DialogDescription>
            Dê um nome ao template para reutilizar depois (ex: &quot;Amoxicilina padrão&quot;).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="template-name">Nome do template</Label>
          <Input
            id="template-name"
            placeholder="Ex: Amoxicilina padrão"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Salvar template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Load mode ──

export interface TemplateDialogLoadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'prescription' | 'exam';
  onSelectPrescription?: (template: PrescriptionTemplate) => void;
  onSelectExam?: (template: ExamTemplate) => void;
}

export function TemplateDialogLoad({
  open,
  onOpenChange,
  mode,
  onSelectPrescription,
  onSelectExam,
}: TemplateDialogLoadProps) {
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const templates = useMemo(() => {
    void refreshTrigger; // trigger re-read when delete or open
    if (mode === 'prescription') return loadPrescriptionTemplates();
    return loadExamTemplates();
  }, [mode, refreshTrigger]);

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase().trim();
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, search]);

  const handleSelect = (t: PrescriptionTemplate | ExamTemplate) => {
    if (mode === 'prescription' && 'medications' in t) {
      onSelectPrescription?.(t as PrescriptionTemplate);
    } else if (mode === 'exam' && 'exams' in t) {
      onSelectExam?.(t as ExamTemplate);
    }
    onOpenChange(false);
    toast.success('Template aplicado');
  };

  const handleDelete = (t: PrescriptionTemplate | ExamTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirm === t.name) {
      if (mode === 'prescription') {
        const list = loadPrescriptionTemplates().filter((x) => x.name !== t.name);
        savePrescriptionTemplates(list);
      } else {
        const list = loadExamTemplates().filter((x) => x.name !== t.name);
        saveExamTemplates(list);
      }
      setDeleteConfirm(null);
      setRefreshTrigger((t) => t + 1);
      toast.success('Template removido');
    } else {
      setDeleteConfirm(t.name);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const count = (t: PrescriptionTemplate | ExamTemplate) =>
    'medications' in t ? t.medications.length : t.exams.length;
  const countLabel = mode === 'prescription' ? 'medicamentos' : 'exames';

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setDeleteConfirm(null);
        if (o) setRefreshTrigger((t) => t + 1);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Usar template</DialogTitle>
          <DialogDescription>
            Selecione um template para preencher o editor.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto space-y-1 pr-1">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {templates.length === 0
                ? 'Nenhum template salvo. Salve um com o botão "Salvar como template".'
                : 'Nenhum template encontrado.'}
            </p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.name + t.createdAt}
                type="button"
                onClick={() => handleSelect(t)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left group"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {count(t)} {countLabel} ·{' '}
                    {new Date(t.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => handleDelete(t, e)}
                  title={deleteConfirm === t.name ? 'Clique novamente para confirmar' : 'Excluir template'}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
