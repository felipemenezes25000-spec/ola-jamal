import { Pill } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  medications: string[];
}

export function MedicationsCard({ medications }: Props) {
  if (!medications.length) return null;
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Pill className="h-4 w-4 text-primary" aria-hidden />
          Medicamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {medications.map((med, i) => (
            <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="font-medium text-sm">{med || '—'}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
