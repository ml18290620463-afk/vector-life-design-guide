# Phase 1 — Pruning & De-bloating

## 1. Write before setup

- Onboarding.tsx: 94,718 → 3,866 bytes (−95.9%). Welcome and password protection are separate components with local CSS; total replacement is about 9.6 KB (−89.9%).
- Welcome / write / protect, with a visible Skip action. No model setup or recovery ceremony before writing.
- Before password setup the draft lives only in React memory. First protection atomically encrypts the draft and installs vault credentials. Normal save subsequently retains the existing AI visibility dialog.
- Returning MasterLock flows are unchanged. Recovery and backup remain in settings.
- Changed: components/Onboarding.tsx, components/onboarding/{WelcomeStep,ProtectionStep}.tsx, components/onboarding/onboarding.css, components/AppEntryGateScreens.tsx, features/now/components/TagSelectPage.tsx, hooks/{useAppEntryRouting,useVaultAuthActions}.ts, services/vaultTransaction.ts; tests: components/Onboarding.test.tsx, services/nowDraftRepository.test.ts, e2e/{app,a11y}.spec.ts, e2e/seedHelpers.ts.
- Validation: typecheck, production build and targeted ESLint passed; 9 unit tests passed; Chrome e2e/app.spec.ts 4/4 passed (390 and 1440 widths, typing within 10 seconds, encryption then private record in Past). Mobile screenshot review caught inherited dark textarea styling; scoped override added.

## 2. Chinese and English only

- Removed five legacy dictionary imports (78,750 source bytes); preserved their files. Legacy preferences normalize to English. Settings, unlock and command palette expose only zh/en.
- Both dictionaries now have 479 matching, nonempty keys. Fixed three missing English keys and four existing empty values.
- Changed: i18n/translations.ts, i18n/locales/{zh,en}.ts, stores/appStore.ts, components/{StatisticsLanguageSwitch,MasterLock,CommandPalette}.tsx; tests: StatisticsLanguageSwitch.test.tsx, i18n/translations.test.ts, e2e/language-options.spec.ts.
- Validation: 7 unit tests, targeted ESLint, typecheck/build and language E2E passed. Build precache decreased from 6971.55 to 6902.71 KiB. Existing hardcoded Chinese in business screens remains a separate localization debt; key parity is not a claim of complete app-wide localization.

## 3. Adaptive motion budget

- Current cover RibbonFabric/Current are now lazy and never mounted for mobile/coarse pointer, reduced motion, <=4 CPU cores / <=4 GB reported memory, data saving or explicit disable. SpaceTimeBackground follows the same policy. Static cover art remains.
- Settings includes a persisted one-click disable control. Four named legacy visuals have no runtime consumers and remain excluded; no new import path was introduced for them.
- Heavy chunks are excluded from service-worker precaching: RibbonFabric 4.93 KB, RibbonCurrent 4.01 KB, SpaceTimeBackground 4.09 KB (uncompressed). Precache 6902.71 → 6891.63 KiB. The small policy hook grows intentionally to replace runtime visual costs.
- Changed: App.tsx, components/{CoverScreen,StatisticsWidget}.tsx, hooks/useMotionPreference.ts, vite.config.ts; tests: hooks/useMotionPreference.test.ts, e2e/{motion-budget,main-navigation-smoothness}.spec.ts.
- Validation: 5 policy unit tests, typecheck/build/targeted ESLint, 4 Chrome E2E passed. Mobile and disabled cover request no visual chunks and mount no canvas; navigation works at 390 and 1440 widths. This does not constitute universal dropped-frame measurements.
