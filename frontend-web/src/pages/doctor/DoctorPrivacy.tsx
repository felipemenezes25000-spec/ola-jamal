/**
 * Política de Privacidade — Página institucional.
 */
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { COMPANY } from '@/lib/company';
import { ArrowLeft, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pb-6 mb-6 border-b border-border/50 last:border-0 last:mb-0 last:pb-0">
      <h2 className="text-sm font-bold text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}

export default function DoctorPrivacy() {
  return (
    <DoctorLayout>
      <div className="space-y-6 max-w-2xl">
        <Link to="/configuracoes">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold">Política de Privacidade – {COMPANY.name}</h1>
            </div>
            <p className="text-xs text-muted-foreground mb-6">Última atualização: março de 2026</p>

            <Section title="1. Compromisso e base legal">
              A {COMPANY.name} está comprometida com a proteção dos seus dados em conformidade com a LGPD (Lei 13.709/2018).
            </Section>
            <Section title="2. Controlador e finalidade">
              Controlador: {COMPANY.name}, CNPJ {COMPANY.cnpj}. DPO: {COMPANY.fullContact}.
              Os dados são tratados para prestação dos serviços de telemedicina, processamento de pagamentos
              e cumprimento de obrigações legais.
            </Section>
            <Section title="3. Dados que coletamos">
              Dados de identificação, cadastro e dados sensíveis de saúde necessários ao atendimento.
              Nas consultas por vídeo: transcrição em texto (não há gravação de áudio ou vídeo).
            </Section>
            <Section title="4. Seus direitos (LGPD)">
              Você tem direito a acesso, correção, portabilidade e eliminação dos dados.
              Contato: {COMPANY.fullContact}.
            </Section>
          </CardContent>
        </Card>
      </div>
    </DoctorLayout>
  );
}
