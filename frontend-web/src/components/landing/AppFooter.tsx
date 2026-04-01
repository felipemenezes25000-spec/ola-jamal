import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clock, Mail, Phone, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '@/assets/logo-renoveja-new.png';

const footerLinks = {
  institucional: [
    { name: 'Problema', href: '#problem' },
    { name: 'Funcionalidades', href: '#features' },
    { name: 'Setores', href: '#partners' },
    { name: 'Contato', href: '#contact' },
  ],
  legal: [
    { name: 'Privacidade (LGPD)', href: '/privacidade' },
    { name: 'Termos de Uso', href: '/termos' },
    { name: 'Cookies', href: '/cookies' },
    { name: 'Contato', href: 'mailto:contato@renovejasaude.com.br' },
    { name: 'WhatsApp', href: 'https://wa.me/5511986318000' },
  ],
};

export function AppFooter() {
  const currentYear = new Date().getFullYear();

  const scrollToSection = (e: React.MouseEvent, href: string) => {
    if (!href.startsWith('#')) return;
    e.preventDefault();
    const element = document.querySelector(href);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#1E3A5F]">
      <div className="border-b border-[#25D366]/30 bg-[#25D366]/10">
        <div className="container mx-auto px-4 py-5">
          <div className="mx-auto flex max-w-4xl items-start gap-3 sm:gap-4">
            <div className="mt-0.5 flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#25D366]">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="text-sm">
              <p className="mb-2 text-sm sm:text-base font-bold text-white">Serviço com foco em conformidade e responsabilidade clínica</p>
              <p className="leading-relaxed text-white/80">
                O RenoveJá+ foi estruturado para apoiar telemedicina e jornadas documentais com uso responsável de IA,
                proteção de dados, rastreabilidade operacional e decisão final sempre do médico.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-amber-500/30 bg-amber-500/10">
        <div className="container mx-auto px-4 py-4">
          <div className="mx-auto flex max-w-4xl items-start sm:items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-400 mt-0.5 sm:mt-0" />
            <p className="text-sm text-white/90">
              <span className="font-bold text-amber-400">Aviso:</span> este site não representa atendimento de urgência ou emergência.
              Em casos graves, procure assistência presencial ou ligue para o <strong className="text-white">SAMU 192</strong>.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <Link to="/" className="group mb-6 inline-flex items-center gap-3">
              <motion.img
                src={logo}
                alt="RenoveJá+"
                className="h-14 w-auto drop-shadow-md"
                whileHover={{ scale: 1.05, rotate: 2 }}
                transition={{ duration: 0.3 }}
              />
              <span className="text-2xl font-bold">
                <span className="text-primary">Renove</span>
                <span className="text-white">Já</span>
                <span className="text-primary">+</span>
              </span>
            </Link>
            <p className="mb-6 max-w-md text-sm leading-relaxed text-white/70">
              Plataforma de telemedicina para apoiar fluxos assistenciais e documentais
              com tecnologia, conformidade e rastreabilidade.
            </p>

            <div className="space-y-3">
              <a
                href="https://wa.me/5511986318000"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Contato pelo WhatsApp: (11) 98631-8000 (abre em nova aba)"
                className="group flex items-center gap-3 text-sm text-white/80 transition-colors hover:text-[#25D366]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366]/20 transition-colors group-hover:bg-[#25D366]" aria-hidden="true">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <span className="block font-medium">(11) 98631-8000</span>
                  <span className="text-xs text-white/50">WhatsApp / contato institucional</span>
                </div>
              </a>
              <a
                href="mailto:contato@renovejasaude.com.br"
                aria-label="Enviar email para contato@renovejasaude.com.br"
                className="group flex items-center gap-3 text-sm text-white/80 transition-colors hover:text-primary"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 transition-colors group-hover:bg-primary" aria-hidden="true">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <span className="block font-medium">contato@renovejasaude.com.br</span>
                  <span className="text-xs text-white/50">Contato institucional</span>
                </div>
              </a>
              <div className="flex items-center gap-3 text-sm text-white/60">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <span className="block font-medium text-white/80">Seg-Sex, 8h às 18h</span>
                  <span className="text-xs text-white/50">Horário comercial</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-5 flex items-center gap-2 text-lg font-bold text-white">
              <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
              Navegação
            </h4>
            <ul className="space-y-3">
              {footerLinks.institucional.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    onClick={(e) => scrollToSection(e, link.href)}
                    className="group flex items-center gap-2 py-1 text-sm text-white/70 transition-colors hover:text-primary"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/50 transition-colors group-hover:bg-primary" />
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-5 flex items-center gap-2 text-lg font-bold text-white">
              <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
              Contato e legal
            </h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  {link.href.startsWith('/') ? (
                    <Link
                      to={link.href}
                      className="group flex items-center gap-2 py-1 text-sm text-white/70 transition-colors hover:text-primary"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/50 transition-colors group-hover:bg-primary" />
                      {link.name}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      target={link.href.startsWith('http') ? '_blank' : undefined}
                      rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      aria-label={link.href.startsWith('http') ? `${link.name} (abre em nova aba)` : link.href.startsWith('mailto:') ? `Enviar email: ${link.name}` : undefined}
                      className="group flex items-center gap-2 py-1 text-sm text-white/70 transition-colors hover:text-primary"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/50 transition-colors group-hover:bg-primary" aria-hidden="true" />
                      {link.name}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-6 md:flex-row">
          <p className="text-center text-sm text-white/60 md:text-left">
            © {currentYear} RenoveJá+. Todos os direitos reservados.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm">
            <span className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/10 px-3 py-2 sm:px-4 sm:py-2.5 text-white/80">
              <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              SSL/TLS
            </span>
            <span className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/10 px-3 py-2 sm:px-4 sm:py-2.5 text-white/80">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#25D366]" />
              LGPD
            </span>
            <span className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/10 px-3 py-2 sm:px-4 sm:py-2.5 text-white/80">
              <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              CFM
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
