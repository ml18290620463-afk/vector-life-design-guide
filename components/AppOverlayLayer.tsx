import type { FC } from 'react';
import type { Language, Theme } from '../types';
import { TRANSLATIONS } from '../constants';
import { PricingPage } from './PricingPage';

type AppOverlayLayerProps = {
  billingCheckoutReturn: unknown;
  language: Language;
  onClosePricing: () => void;
  pricingInstallId: string | null;
  pricingOpen: boolean;
  theme: Theme;
};

export const AppOverlayLayer: FC<AppOverlayLayerProps> = ({
  billingCheckoutReturn,
  language,
  onClosePricing,
  pricingInstallId,
  pricingOpen,
  theme,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <>
      {pricingOpen && (
        <PricingPage theme={theme} t={t} installId={pricingInstallId} onClose={onClosePricing} />
      )}
      {void billingCheckoutReturn}
    </>
  );
};
