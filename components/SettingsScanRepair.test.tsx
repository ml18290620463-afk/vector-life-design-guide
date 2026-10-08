import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsScanRepair } from './SettingsScanRepair';
import { TRANSLATIONS } from '../constants';

const t = TRANSLATIONS.zh;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SettingsScanRepair', () => {
  it('renders idle state with the EXECUTE button when not scanning', () => {
    render(<SettingsScanRepair theme="dark" language="zh" t={t} />);
    expect(screen.getByText(/执行扫描/)).toBeTruthy();
  });

  it('renders the SCANNING button + progress bar when isScanning=true', () => {
    render(<SettingsScanRepair theme="dark" language="zh" t={t} isScanning scanProgress={42} />);
    expect(screen.getByText(/正在扫描/)).toBeTruthy();
    expect(screen.getByText('42%')).toBeTruthy();
  });

  it('clicking EXECUTE goes through window.confirm before triggering the scan', () => {
    const onTriggerScan = vi.fn();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    render(<SettingsScanRepair theme="dark" language="zh" t={t} onTriggerScan={onTriggerScan} />);
    fireEvent.click(screen.getByText(/执行扫描/));
    expect(window.confirm).toHaveBeenCalled();
    expect(onTriggerScan).toHaveBeenCalled();
  });

  it('does not call onTriggerScan when window.confirm is declined', () => {
    const onTriggerScan = vi.fn();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    render(<SettingsScanRepair theme="dark" language="zh" t={t} onTriggerScan={onTriggerScan} />);
    fireEvent.click(screen.getByText(/执行扫描/));
    expect(onTriggerScan).not.toHaveBeenCalled();
  });

  it('renders success summary with substituted counts when last scan succeeded', () => {
    render(
      <SettingsScanRepair
        theme="dark"
        language="zh"
        t={t}
        lastScanSummary={{
          status: 'success',
          finishedAt: 1,
          mergedEntries: 3,
          mergedPrinciples: 4,
          mergedContainers: 5,
        }}
      />,
    );
    expect(screen.getByRole('status').textContent).toMatch(/3.*4.*5/);
  });

  it('renders failure copy + Retry button when last scan failed', () => {
    const onTriggerScan = vi.fn();
    render(
      <SettingsScanRepair
        theme="dark"
        language="zh"
        t={t}
        lastScanSummary={{
          status: 'error',
          finishedAt: 1,
          mergedEntries: 0,
          mergedPrinciples: 0,
          mergedContainers: 0,
          error: 'boom',
        }}
        onTriggerScan={onTriggerScan}
      />,
    );
    fireEvent.click(screen.getByText(t.scanRetry ?? 'Retry scan'));
    expect(onTriggerScan).toHaveBeenCalled();
  });
});
