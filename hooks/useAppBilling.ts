import { useState } from 'react';
import { useLicense, type UseLicenseResult } from './useLicense';
import { useCheckoutReturn, type UseCheckoutReturnResult } from './useCheckoutReturn';

/**
 * Phase 5.2 — `useAppBilling`
 *
 * Composite hook bundling the three Phase 5 React surfaces:
 *
 *   - `useLicense()` — reads the persisted license token,
 *     exposes `currentTier` / `payload` / activate / deactivate.
 *   - `useCheckoutReturn({ onActivate })` — listens to URL
 *     `?activate_session_id=...` / `?activate_cancelled=1`
 *     after Stripe redirects the user back to the app.
 *   - `showPricing` boolean — opens the public PricingPage
 *     overlay. Initialised from `?pricing=1` query so direct
 *     marketing links land on the page.
 *
 * Mounted ONCE at the App root. Without this composite, App.tsx
 * needs to wire the three surfaces by hand AND glue them together
 * (the checkout-return hook needs `license.activate` for its
 * `onActivate` callback). The composite keeps that wiring inside
 * one module + lets App.tsx stay below the 600-LOC ceiling.
 *
 * # API
 *
 * The return shape mirrors React's own `useReducer` style: a
 * single object with discriminated sub-states. Consumers
 * destructure what they need (`billing.license` for paywall
 * checks, `billing.showPricing` for the PricingPage mount,
 * `billing.openPricing()` for Settings → Upgrade clicks).
 */
export interface UseAppBillingResult {
  license: UseLicenseResult;
  checkoutReturn: UseCheckoutReturnResult;
  showPricing: boolean;
  setShowPricing: (next: boolean) => void;
  openPricing: () => void;
  /**
   * Bundled props the App passes through Dashboard →
   * DashboardSettingsModal → SettingsPanel → LicenseSection.
   * Pre-bundled here so App.tsx stays under the 600-LOC ceiling.
   */
  licensePropsForDashboard: {
    licenseInstallId: string;
    licenseCurrentTier: UseLicenseResult['currentTier'];
    licensePayload: UseLicenseResult['payload'];
    licenseFailure: UseLicenseResult['failure'];
    onActivateLicense: UseLicenseResult['activate'];
    onDeactivateLicense: UseLicenseResult['deactivate'];
    onOpenPricing: () => void;
  };
}

const initialPricingFromQuery = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('pricing') === '1';
  } catch {
    return false;
  }
};

export const useAppBilling = (): UseAppBillingResult => {
  const license = useLicense();
  const checkoutReturn = useCheckoutReturn({
    onActivate: (token) => license.activate(token),
  });
  const [showPricing, setShowPricing] = useState<boolean>(initialPricingFromQuery);

  const openPricing = () => setShowPricing(true);
  const licensePropsForDashboard = {
    licenseInstallId: license.installId,
    licenseCurrentTier: license.currentTier,
    licensePayload: license.payload,
    licenseFailure: license.failure,
    onActivateLicense: license.activate,
    onDeactivateLicense: license.deactivate,
    onOpenPricing: openPricing,
  };
  return {
    license,
    checkoutReturn,
    showPricing,
    setShowPricing,
    openPricing,
    licensePropsForDashboard,
  };
};
