import { FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  exams: string[];
}

export function ExamsCard({ exams }: Props) {
  if (!exams.length) return null;
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" aria-hidden />
          Exames Solicitados
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {exams.map((exam, i) => (
            <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="font-medium text-sm">{exam || '—'}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
