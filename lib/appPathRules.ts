export type AppMainTabPath = 'past' | 'now' | 'future' | 'avatar';
export type AppNowRoutePath = 'now' | 'tags' | 'avatar-chat';

export const isNowSurfacePathname = (pathname: string): boolean =>
  pathname === '/avatar' || pathname === '/now' || pathname.startsWith('/now/');

export const getNowRouteFromPathname = (pathname: string): AppNowRoutePath | null => {
  if (pathname === '/avatar') return 'avatar-chat';
  if (pathname === '/now/tags') return 'tags';
  if (pathname === '/now/avatar-chat') return 'avatar-chat';
  if (pathname === '/now') return 'now';
  return null;
};

export const getMainTabFromPathname = (pathname: string): AppMainTabPath | null => {
  if (pathname === '/past') return 'past';
  if (pathname === '/future') return 'future';
  if (pathname === '/avatar') return 'avatar';
  if (pathname === '/now' || pathname.startsWith('/now/')) return 'now';
  return null;
};

export const getNowPathname = (route: AppNowRoutePath): string => {
  if (route === 'avatar-chat') return '/avatar';
  if (route === 'now') return '/now';
  return `/now/${route}`;
};

export const getMainTabPathname = (tab: AppMainTabPath): string => {
  if (tab === 'now') return '/now';
  return `/${tab}`;
};

export const getRestorablePathname = (pathname: string): string | null =>
  getNowRouteFromPathname(pathname) || getMainTabFromPathname(pathname) ? pathname : null;
