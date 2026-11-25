import { expect, test } from '@playwright/test';

for (const [mode, viewport] of [
  ['web', { width: 1440, height: 1000 }],
  ['mobile', { width: 390, height: 844 }],
] as const) {
  for (const screen of ['protection', 'unlock', 'recovery', 'model-settings'] as const) {
    test(`${mode} ${screen} current component capture`, async ({ page }, info) => {
      await page.setViewportSize(viewport);
      await page.route('**/__ui_final_capture*', (route) => route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html class="light vector-force-${mode}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/index.css"><link rel="stylesheet" href="/styles/experiences.css"><link rel="stylesheet" href="/styles/vector-silk-tokens.css"><link rel="stylesheet" href="/components/onboarding/onboarding.css"><link rel="stylesheet" href="/components/account.css"><link rel="stylesheet" href="/components/silk/silk.css"><link rel="stylesheet" href="/styles/vector-silk-shell.css"></head><body><div id="root"></div><script type="module">
          import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
          const React=(await import('/node_modules/.vite/deps/react.js')).default;
          const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
          const noop=()=>{};let content;
          if ('${screen}'==='protection') {const {ProtectionStep}=await import('/components/onboarding/ProtectionStep.tsx');content=React.createElement(ProtectionStep,{language:'zh',onSave:async()=>{},onBack:noop});}
          if ('${screen}'==='unlock') {const {MasterLockUnlockForm}=await import('/components/MasterLockUnlockForm.tsx');content=React.createElement(MasterLockUnlockForm,{theme:'light',language:'zh',t:{enterMasterPassword:'输入通行密令',showPassword:'显示密码',hidePassword:'隐藏密码'},password:'',onPasswordChange:noop,showUnlockPassword:false,onToggleShowPassword:noop,onSubmit:noop,isDecrypting:false,isScanning:false,isSuccess:false,isRitualActive:false,error:false,biometricError:null,lockout:{isLocked:false,secondsRemaining:0},onForgotPassword:noop});}
          if ('${screen}'==='recovery') {const {MasterLockRecoveryForm}=await import('/components/MasterLockRecoveryForm.tsx');content=React.createElement(MasterLockRecoveryForm,{theme:'light',t:{resetPassword:'重设密令',inputRecoveryKey:'输入恢复私钥，重新设置密令',recoveryKeyTitle:'恢复私钥',newPassword:'新密令',confirmPassword:'确认新密令'},recovery:{recoveryInput:'',setRecoveryInput:noop,showKey:false,toggleShowKey:noop,newPassword:'',setNewPassword:noop,confirmNewPassword:'',setConfirmNewPassword:noop,showNewPassword:false,toggleShowNewPassword:noop,resetError:null,submitRecovery:noop,isSubmitting:false}});}
          if ('${screen}'==='model-settings') {const {AvatarModelSettings}=await import('/features/now/components/AvatarModelSettings.tsx');content=React.createElement(AvatarModelSettings,{onClose:noop,onSaved:noop});}
          const frame='${screen}'==='model-settings'?content:React.createElement('main',{className:'master-lock-overlay',style:{minHeight:'100dvh',display:'grid',placeItems:'center',background:'#f6f9fd',padding:'16px'}},'${screen}'==='protection'?content:React.createElement('div',{className:'master-lock-card',style:{width:'min(400px,100%)',padding:'28px',background:'#fff',borderRadius:'20px'}},content));
          ReactDOM.createRoot(document.getElementById('root')).render(frame);
        </script></body></html>`,
      }));
      await page.goto('/__ui_final_capture');
      await expect(page.locator(screen === 'model-settings' ? 'dialog' : screen === 'protection' ? '.onboarding-simple-card' : '.master-lock-card')).toBeVisible();
      const card = page.locator(screen === 'model-settings' ? 'dialog' : screen === 'protection' ? '.onboarding-simple-card' : '.master-lock-card');
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(12);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 12);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: info.outputPath(`${mode}-${screen}.png`) });
    });
  }
}

// These states have no stable URL. Capture the real product components in a
// local fixture and label them as such in the overview manifest.
for (const [mode, viewport] of [
  ['web', { width: 1440, height: 1000 }],
  ['mobile', { width: 390, height: 844 }],
] as const) {
  for (const screen of ['now-empty', 'now-tags', 'future-complete', 'avatar-memory-detail', 'avatar-memory-edit', 'avatar-data-backup'] as const) {
    test(`${mode} ${screen} current component capture`, async ({ page }, info) => {
      await page.setViewportSize(viewport);
      await page.route('**/__ui_final_extra*', (route) => route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html class="light vector-force-${mode}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/index.css"><link rel="stylesheet" href="/styles/experiences.css"><link rel="stylesheet" href="/styles/vector-silk-tokens.css"><link rel="stylesheet" href="/components/silk/silk.css"><link rel="stylesheet" href="/features/future/future.css"><link rel="stylesheet" href="/features/now/components/avatarGuidance.css"><link rel="stylesheet" href="/styles/vector-silk-shell.css"></head><body><div id="root"></div><script type="module">
          import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;
          const React=(await import('/node_modules/.vite/deps/react.js')).default;
          const ReactDOM=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
          const noop=()=>{};const draft={text:'',materials:[],mood_tags:[],event_tags:[],record_time:'2026-09-22',display_time:'2026年9月22日',updated_at:'2026-09-22'};
          const memory={id:'capture-memory',schemaVersion:2,domain:'about_me',category:'values_motivation',statement:'我希望把注意力放回真正重要的事',status:'${screen === 'avatar-memory-edit' ? 'candidate' : 'confirmed'}',validity:{mode:'long_term',validFrom:'2026-09-22T09:00:00.000Z'},privacy:{sensitivity:'normal',aiVisible:false,traceabilityDegraded:false},evidenceGate:{requiresMultiSourceGate:false,independentExperienceCount:1,distinctUserMessageCount:1,distinctDateCount:1,distinctSessionCount:1,isReadyForConfirmation:true},confidenceScore:0.8,reinforcementCount:0,version:1,lineageId:'capture-memory',origin:'user_manual',createdAt:'2026-09-22T09:00:00.000Z',updatedAt:'2026-09-22T09:00:00.000Z'};
          let content;
          if ('${screen}'==='now-empty') {const {NowPage}=await import('/features/now/components/NowPage.tsx');content=React.createElement(NowPage,{draft,setDraft:noop,sending:false,onSend:noop,onSaveDraft:async()=>true,onDiscardDraft:async()=>true,onExit:noop,onRouteChange:noop,showToast:noop,mobileShell:${mode === 'mobile'}});}
          if ('${screen}'==='now-tags') {const {TagSelectPage}=await import('/features/now/components/TagSelectPage.tsx');content=React.createElement(TagSelectPage,{draft,setDraft:noop,onBack:noop,showToast:noop});}
          if ('${screen}'==='future-complete') {const {GrowthLoopCompletionDialog}=await import('/features/future/GrowthLoopCompletionDialog.tsx');const {SilkToast}=await import('/components/silk/SilkToast.tsx');content=React.createElement('main',{className:'future-page',style:{minHeight:'100dvh',padding:'48px'}},React.createElement('h1',null,'践行'),React.createElement(GrowthLoopCompletionDialog,{action:{id:'action-1',title:'完成今天的重要行动',status:'completed',source:'global'},feedback:{status:'completed',note:'完成后有了更清晰的方向。',nextStep:'end'},opener:null,onClose:noop}),React.createElement(SilkToast,{message:'践行已记录'}));}
          if ('${screen}'.startsWith('avatar-memory-')) {const {AvatarMemoryDetail}=await import('/features/now/components/AvatarMemoryDetail.tsx');content=React.createElement(AvatarMemoryDetail,{memory,onClose:noop,onSave:noop,onSupersede:noop});}
          if ('${screen}'==='avatar-data-backup') {const {AvatarDataModelCenter}=await import('/features/now/components/AvatarDataModelCenter.tsx');content=React.createElement(AvatarDataModelCenter,{draft,onBack:noop,onOpenDraft:noop,showToast:noop});}
          ReactDOM.createRoot(document.getElementById('root')).render(content);
        </script></body></html>`,
      }));
      await page.goto('/__ui_final_extra');
      const target = screen.startsWith('avatar-memory-') ? '.avatar-memory-dialog' : screen === 'future-complete' ? '.growth-loop-completion' : screen === 'avatar-data-backup' ? '.avatar-data-model-center' : '.now-page';
      await expect(page.locator(target)).toBeVisible();
      if (screen === 'future-complete') {
        await expect(page.locator('.future-pearl-spark')).toBeVisible();
        await expect(page.locator('.silk-toast')).toHaveText('践行已记录');
      }
      if (screen === 'future-complete' || screen.startsWith('avatar-memory-')) {
        const dialog = page.locator(screen === 'future-complete' ? '.growth-loop-completion' : '.avatar-memory-dialog');
        const box = (await dialog.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(12);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 12);
        expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
      }
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: info.outputPath(`${mode}-${screen}.png`) });
    });
  }
}
