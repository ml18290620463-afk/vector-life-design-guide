export type PreviewMode = 'mobile' | 'web';

export const getPreviewMode = (): PreviewMode | null => {
  if (typeof window === 'undefined') return null;
  const mode = new URLSearchParams(window.location.search).get('preview');
  return mode === 'mobile' || mode === 'web' ? mode : null;
};

/** Remove links to retired visual fixtures before normal entry routing runs. */
export const removeObsoletePreviewQuery = (): void => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const preview = url.searchParams.get('preview');
  if (!preview || preview === 'mobile' || preview === 'web') return;
  url.searchParams.delete('preview');
  url.searchParams.delete('screen');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
};

export const isMobileExperience = (): boolean => {
  if (typeof window === 'undefined') return false;
  const mode = getPreviewMode();
  if (mode) return mode === 'mobile';
  return (
    document.documentElement.classList.contains('vector-force-mobile') ||
    window.matchMedia('(max-width: 767px)').matches
  );
};

export const buildPreviewAwarePath = (pathname: string): string => {
  if (typeof window === 'undefined') return pathname;
  const preview = getPreviewMode();
  if (!preview) return pathname;
  const params = new URLSearchParams();
  params.set('preview', preview);
  return `${pathname}?${params.toString()}`;
};

export const replaceAppPath = (pathname: string, state: Record<string, unknown> = {}) => {
  if (typeof window === 'undefined') return;
  const nextUrl = buildPreviewAwarePath(pathname);
  if (window.location.pathname + window.location.search !== nextUrl) {
    try {
      window.history.replaceState(state, '', nextUrl);
    } catch (err) {
      console.warn('previewMode: replaceState failed; continuing without URL sync', err);
    }
  }
};

export const pushAppPath = (pathname: string, state: Record<string, unknown> = {}) => {
  if (typeof window === 'undefined') return;
  const nextUrl = buildPreviewAwarePath(pathname);
  if (window.location.pathname + window.location.search !== nextUrl) {
    try {
      window.history.pushState(state, '', nextUrl);
    } catch (err) {
      console.warn('previewMode: pushState failed; continuing without URL sync', err);
    }
  }
};
