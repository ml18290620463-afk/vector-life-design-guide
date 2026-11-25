import type { FC, SVGProps } from 'react';
export type SilkNavIconName = 'past' | 'now' | 'future' | 'avatar';
export const SilkNavIcon: FC<SVGProps<SVGSVGElement> & { name: SilkNavIconName }> = ({ name, ...props }) => <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
  {name === 'past' && <><rect x="2.5" y="3" width="11" height="10" rx="2"/><path d="M2.5 6.5H13.5"/></>}
  {name === 'now' && <><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="1.4"/></>}
  {name === 'future' && <path d="M3.5 12.5L12.5 3.5M12.5 3.5H6M12.5 3.5V10"/>}
  {name === 'avatar' && <path d="M8 2.5L9.3 6.7L13.5 8L9.3 9.3L8 13.5L6.7 9.3L2.5 8L6.7 6.7L8 2.5Z"/>}
</svg>;
