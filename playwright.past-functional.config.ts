import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, webServer: { ...base.webServer, timeout: 120000 } });
