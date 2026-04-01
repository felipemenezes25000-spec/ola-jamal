import { AppBenefitsSection } from '@/components/landing/AppBenefitsSection';
import { AppCTASection } from '@/components/landing/AppCTASection';
import { AppFAQSection } from '@/components/landing/AppFAQSection';
import { AppFooter } from '@/components/landing/AppFooter';
import { AppHeader } from '@/components/landing/AppHeader';
import { AppHeroSection } from '@/components/landing/AppHeroSection';
import { AppPricingSection } from '@/components/landing/AppPricingSection';
import { AppScreensSection } from '@/components/landing/AppScreensSection';
import { AppStepsSection } from '@/components/landing/AppStepsSection';
import { AppTestimonialsSection } from '@/components/landing/AppTestimonialsSection';
import { AppTutorialSection } from '@/components/landing/AppTutorialSection';
import { WhatsAppButton } from '@/components/landing/WhatsAppButton';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main id="main-content">
        <AppHeroSection />
        <AppStepsSection />
        <AppBenefitsSection />
        <AppTutorialSection />
        <AppScreensSection />
        <AppTestimonialsSection />
        <AppPricingSection />
        <AppFAQSection />
        <AppCTASection />
      </main>
      <AppFooter />
      <WhatsAppButton />
    </div>
  );
};

export default Index;
