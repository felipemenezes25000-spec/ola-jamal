/**
 * Sobre o RenoveJá+ — Página institucional.
 */
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { COMPANY } from '@/lib/company';
import { ArrowLeft, Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DoctorAbout() {
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
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Stethoscope className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">RenoveJá+</h1>
                <p className="text-sm text-muted-foreground">{COMPANY.name}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Plataforma de telemedicina que conecta pacientes e médicos para renovação de receitas,
              solicitação de exames e consultas online. Serviços em conformidade com a Resolução CFM nº 2.314/2022.
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>CNPJ:</strong> {COMPANY.cnpj}</p>
              <p><strong>Endereço:</strong> {COMPANY.address}</p>
              <p><strong>Contato:</strong> {COMPANY.fullContact}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DoctorLayout>
  );
}
