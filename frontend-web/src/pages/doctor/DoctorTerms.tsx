/**
 * Termos de Uso — Página institucional.
 */
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { COMPANY } from '@/lib/company';
import { ArrowLeft, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pb-6 mb-6 border-b border-border/50 last:border-0 last:mb-0 last:pb-0">
      <h2 className="text-sm font-bold text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}

export default function DoctorTerms() {
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
              <FileText className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold">Termos de Uso – {COMPANY.name}</h1>
            </div>
            <p className="text-xs text-muted-foreground mb-6">Última atualização: março de 2026</p>

            <Section title="1. Identificação do prestador">
              {COMPANY.name}, CNPJ {COMPANY.cnpj}, com sede em {COMPANY.address}. Contato: {COMPANY.fullContact}.
              Estes Termos regem o uso do aplicativo RenoveJá+ e dos serviços de telemedicina oferecidos pela plataforma.
            </Section>
            <Section title="2. Aceitação dos Termos">
              Ao utilizar o RenoveJá+ ({COMPANY.name}), você declara ter lido e aceitado os presentes Termos de Uso.
              Os serviços são oferecidos a maiores de 18 anos ou com representação legal.
            </Section>
            <Section title="3. Telemedicina e normativas">
              Os atendimentos observam a Resolução CFM nº 2.314/2022 (telemedicina). As consultas são registradas
              em prontuário eletrônico. O médico mantém autonomia para indicar atendimento presencial quando necessário.
            </Section>
            <Section title="4. Limitação de responsabilidade">
              A {COMPANY.name} é responsável pelo meio tecnológico. O conteúdo clínico e as condutas médicas são de
              responsabilidade exclusiva do profissional que realiza o atendimento.
            </Section>
            <Section title="5. Contato e foro">
              Dúvidas: {COMPANY.fullContact}. Foro da comarca de São Paulo/SP.
            </Section>
          </CardContent>
        </Card>
      </div>
    </DoctorLayout>
  );
}
