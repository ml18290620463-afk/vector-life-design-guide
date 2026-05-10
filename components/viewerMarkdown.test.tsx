import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import Markdown from 'react-markdown';
import { buildViewerMarkdownComponents } from './viewerMarkdown';

const renderMarkdown = (source: string) =>
  render(<Markdown components={buildViewerMarkdownComponents('dark')}>{source}</Markdown>);

describe('buildViewerMarkdownComponents', () => {
  it('renders an https link with the cyber styling and a safe rel attribute', () => {
    const { container } = renderMarkdown('[hello](https://example.com)');
    const anchor = container.querySelector('a') as HTMLAnchorElement;
    expect(anchor.getAttribute('href')).toBe('https://example.com');
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toContain('noopener');
    expect(anchor.className).toContain('text-cyan-400');
  });

  it('blocks links that use a disallowed scheme (javascript:)', () => {
    const { container } = renderMarkdown('[click](javascript:alert(1))');
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('[blocked link]');
  });

  it('renders [video](http…mp4) as a real <video> tag', () => {
    const { container } = renderMarkdown('[video](https://example.com/clip.mp4)');
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.getAttribute('src')).toBe('https://example.com/clip.mp4');
    expect(video.getAttribute('aria-label')).toContain('video attachment');
  });

  it('blocks an image with a disallowed scheme (file://)', () => {
    const { container } = renderMarkdown('![pic](file:///etc/passwd)');
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('[blocked image]');
  });

  it('renders an img with referrerPolicy=no-referrer for an allowed scheme', () => {
    const { container } = renderMarkdown('![alt](https://cdn.example.com/x.png)');
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(img.getAttribute('alt')).toBe('alt');
  });

  it('renders [pdf](https://…/x.pdf) inside a sandboxed iframe', () => {
    const { container } = renderMarkdown('[pdf](https://example.com/file.pdf)');
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    expect(iframe.getAttribute('sandbox')).toBe('allow-same-origin allow-scripts');
    expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer');
  });
});
