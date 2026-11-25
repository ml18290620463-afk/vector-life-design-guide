import type { ReactNode } from 'react';
import './silk.css';

export interface SilkTab<T extends string> { id: T; label: ReactNode }
export interface SilkSegmentedTabsProps<T extends string> {
  tabs: readonly SilkTab<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}
export function SilkSegmentedTabs<T extends string>({ tabs, value, onChange, label, className = '' }: SilkSegmentedTabsProps<T>) {
  return <div className={`silk-tabs ${className}`.trim()} role="tablist" aria-label={label}>
    {tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={value === tab.id}
      className={`silk-tabs__tab ${value === tab.id ? 'silk-tabs__tab--active' : ''}`}
      onClick={() => onChange(tab.id)}>{tab.label}</button>)}
  </div>;
}
