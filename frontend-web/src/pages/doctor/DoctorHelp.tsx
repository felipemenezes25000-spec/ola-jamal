/**
 * Ajuda e FAQ — Página de suporte.
 */
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { COMPANY } from '@/lib/company';
import { ArrowLeft, HelpCircle, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const FAQ = [
  { q: 'Como aceitar uma consulta?', a: 'No detalhe do pedido, quando o status permitir, use o botão "Aceitar Consulta". Após aceitar, você poderá iniciar a videochamada.' },
  { q: 'Onde fica a transcrição da consulta?', a: 'Após encerrar a videochamada, a transcrição e a anamnese gerada pela IA ficam disponíveis no resumo da consulta e no detalhe do pedido.' },
  { q: 'Como incluir a conduta no PDF?', a: 'No detalhe do pedido de consulta, edite a conduta e marque "Incluir conduta no PDF do documento assinado".' },
  { q: 'Como acessar planos de cuidados?', a: 'Planos de cuidados são criados a partir de sugestões de exame após a consulta. O link para o plano é enviado por notificação.' },
];

export default function DoctorHelp() {
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
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              Perguntas frequentes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {FAQ.map((item, i) => (
              <div key={i} className="border-b border-border/50 pb-4 last:border-0 last:pb-0">
                <p className="font-semibold text-sm mb-1">{item.q}</p>
                <p className="text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-3">Precisa de mais ajuda?</p>
            <a
              href={COMPANY.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <MessageCircle className="h-4 w-4" />
              Contato via WhatsApp: {COMPANY.phone}
            </a>
          </CardContent>
        </Card>
      </div>
    </DoctorLayout>
  );
}
