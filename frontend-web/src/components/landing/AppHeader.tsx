import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronUp, Menu, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo-renoveja-new.png';

const navLinks = [
  { name: 'Problema', href: '#problem' },
  { name: 'Solução', href: '#solution' },
  { name: 'Funcionalidades', href: '#features' },
  { name: 'Telas', href: '#screenshots' },
  { name: 'Conformidade', href: '#compliance' },
  { name: 'Setores', href: '#partners' },
  { name: 'Contato', href: '#contact' },
];

export function AppHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('problem');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 16);
      setShowScrollTop(window.scrollY > 600);

      const scrollHeight = document.body.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;
      setScrollProgress(Math.min(100, progress));

      const sections = ['hero', ...navLinks.map((link) => link.href.replace('#', ''))];
      for (const section of sections.reverse()) {
        const element = document.getElementById(section);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (rect.top <= 150) {
          setActiveSection(section);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (!element) return;

    const offset = 84;
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled
            ? 'bg-card/95 backdrop-blur-xl shadow-elevated border-b border-border/50'
            : 'bg-card/80 backdrop-blur-sm'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between sm:h-20">
            <button onClick={scrollToTop} className="flex items-center gap-2 sm:gap-3 group" aria-label="Voltar ao topo">
              <motion.div
                className="relative"
                initial={{ opacity: 0, scale: 0.8, rotate: -8 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                whileHover={{ scale: 1.05, rotate: 2 }}
              >
                <img src={logo} alt="RenoveJá+" className="h-10 w-auto drop-shadow-md sm:h-12" />
              </motion.div>
              <motion.span
                className="hidden text-lg font-bold sm:block sm:text-xl"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 0.4 }}
              >
                <span className="text-primary">Renove</span>
                <span className="text-foreground">Já</span>
                <span className="text-primary">+</span>
              </motion.span>
            </button>

            <nav aria-label="Menu de navegação principal" className="hidden items-center gap-1 lg:flex">
              {navLinks.map((link) => {
                const isActive = activeSection === link.href.replace('#', '');
                return (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => { e.preventDefault(); scrollToSection(link.href); }}
                    aria-current={isActive ? 'true' : undefined}
                    className={`relative rounded-xl px-4 py-2 text-sm font-medium transition-all duration-300 ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/70 hover:bg-primary/5 hover:text-primary'
                    }`}
                  >
                    {link.name}
                    {isActive && (
                      <motion.div
                        layoutId="activeSection"
                        className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary"
                      />
                    )}
                  </a>
                );
              })}
            </nav>

            <div className="hidden lg:flex">
              <Button
                onClick={() => scrollToSection('#contact')}
                className="gap-2 rounded-xl font-semibold shadow-primary transition-all duration-300 hover:shadow-elevated"
              >
                <MessageCircle className="h-4 w-4" />
                Fale com a gente
              </Button>
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="rounded-lg p-2 text-foreground transition-colors hover:bg-muted lg:hidden"
              aria-label={isMobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav-menu"
            >
              {isMobileMenuOpen ? <X size={24} aria-hidden /> : <Menu size={24} aria-hidden />}
            </button>
          </div>
        </div>

        <motion.div className="absolute bottom-0 left-0 h-0.5 bg-primary" style={{ width: `${scrollProgress}%` }} />
      </motion.header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
            />

            <motion.div
              id="mobile-nav-menu"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="fixed inset-x-0 top-16 sm:top-20 z-50 mx-3 sm:mx-4 overflow-hidden rounded-2xl border border-border/50 bg-background/95 shadow-elevated backdrop-blur-xl lg:hidden"
            >
              <nav aria-label="Menu de navegação móvel" className="flex flex-col gap-1 p-4">
                {navLinks.map((link) => {
                  const isActive = activeSection === link.href.replace('#', '');
                  return (
                    <a
                      key={link.name}
                      href={link.href}
                      onClick={(e) => { e.preventDefault(); scrollToSection(link.href); }}
                      aria-current={isActive ? 'true' : undefined}
                      className={`rounded-xl px-4 py-3 text-left font-medium transition-all ${
                        isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      {link.name}
                    </a>
                  );
                })}
                <div className="mt-2 border-t border-border pt-3">
                  <Button onClick={() => scrollToSection('#contact')} className="h-12 w-full gap-2 font-semibold">
                    <MessageCircle className="h-5 w-5" />
                    Fale com a gente
                  </Button>
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed bottom-24 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-primary transition-transform hover:scale-110"
            aria-label="Voltar ao topo"
          >
            <ChevronUp className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
