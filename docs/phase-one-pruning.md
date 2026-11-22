# Phase 1 — Pruning & De-bloating

## 1. Write before setup

- Onboarding.tsx: 94,718 → 3,866 bytes (−95.9%). Welcome and password protection are separate components with local CSS; total replacement is about 9.6 KB (−89.9%).
- Welcome / write / protect, with a visible Skip action. No model setup or recovery ceremony before writing.
- Before password setup the draft lives only in React memory. First protection atomically encrypts the draft and installs vault credentials. Normal save subsequently retains the existing AI visibility dialog.
- Returning MasterLock flows are unchanged. Recovery and backup remain in settings.
- Changed: components/Onboarding.tsx, components/onboarding/{WelcomeStep,ProtectionStep}.tsx, components/onboarding/onboarding.css, components/AppEntryGateScreens.tsx, features/now/components/TagSelectPage.tsx, hooks/{useAppEntryRouting,useVaultAuthActions}.ts, services/vaultTransaction.ts; tests: components/Onboarding.test.tsx, services/nowDraftRepository.test.ts, e2e/{app,a11y}.spec.ts, e2e/seedHelpers.ts.
- Validation: typecheck, production build and targeted ESLint passed; 9 unit tests passed; Chrome e2e/app.spec.ts 4/4 passed (390 and 1440 widths, typing within 10 seconds, encryption then private record in Past). Mobile screenshot review caught inherited dark textarea styling; scoped override added.
