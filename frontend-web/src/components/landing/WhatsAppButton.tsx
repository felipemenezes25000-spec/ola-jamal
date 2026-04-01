import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

export function WhatsAppButton() {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const hero = document.getElementById('hero');
      const trigger = hero ? hero.offsetHeight * 0.65 : 500;
      setShowButton(window.scrollY > trigger);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!showButton) return null;

  return (
    <motion.a
      href="https://wa.me/5511986318000"
      target="_blank"
      rel="noopener noreferrer"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.96 }}
      aria-label="Falar sobre parceria pelo WhatsApp"
      className="group fixed bottom-6 left-6 z-50 flex items-center gap-3 rounded-full bg-[#25D366] px-4 py-3 sm:px-5 sm:py-4 text-white shadow-2xl transition-shadow hover:shadow-[0_8px_32px_rgba(37,211,102,0.4)]"
    >
      <MessageCircle className="h-6 w-6" aria-hidden />
      <span className="hidden font-semibold sm:inline-block" aria-hidden>Falar sobre parceria</span>
    </motion.a>
  );
}
