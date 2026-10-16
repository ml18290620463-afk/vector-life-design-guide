import React, { useEffect, useRef, useState } from 'react';
import {
  Link as LinkIcon,
  Paperclip,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react';
import type { Material } from '../types/now';
import { getAudioPlayLabel, getMaterialAlt, getMaterialTitle } from '../../../lib/materialDisplay';

interface MaterialPreviewProps {
  materials: Material[];
  onRemove: (id: string) => void;
  onMove?: (id: string, offset: number) => void;
  onUpdateDescription: (id: string, description: string) => void;
  onReplaceLink: (id: string) => void;
}

export const MaterialPreview: React.FC<MaterialPreviewProps> = ({
  materials,
  onRemove,
  onMove,
  onUpdateDescription,
  onReplaceLink,
}) => {
  const [details, setDetails] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const images = materials.filter((item) => item.type === 'image' && item.url);
  const activeIndex = images.findIndex((item) => item.id === viewing);
  useEffect(() => {
    if (activeIndex < 0) return;
    viewerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewing(null);
      if (event.key === 'ArrowLeft' && activeIndex > 0) setViewing(images[activeIndex - 1].id);
      if (event.key === 'ArrowRight' && activeIndex < images.length - 1)
        setViewing(images[activeIndex + 1].id);
      if (event.key === 'Tab') {
        const buttons = [
          ...(viewerRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []),
        ];
        if (!buttons.length) return;
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (event.shiftKey && index <= 0) {
          event.preventDefault();
          buttons[buttons.length - 1].focus();
        }
        if (!event.shiftKey && index === buttons.length - 1) {
          event.preventDefault();
          buttons[0].focus();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeIndex, images]);
  useEffect(() => {
    if (viewing) return;
    previousFocus.current?.focus();
    previousFocus.current = null;
  }, [viewing]);
  if (materials.length === 0) return null;
  return (
    <div className="now-materials">
      {materials.map((material, index) => (
        <div key={material.id} className="now-material">
          {material.type === 'image' && material.url ? (
            <button
              type="button"
              onClick={(event) => {
                previousFocus.current = event.currentTarget;
                setViewing(material.id);
              }}
              aria-label={`查看图片：${getMaterialTitle(material)}`}
            >
              <img src={material.url} alt={getMaterialAlt(material)} />
            </button>
          ) : material.type === 'audio' && material.url ? (
            <AudioPreview material={material} />
          ) : material.type === 'video' && material.url ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- user-uploaded video has no caption track
            <video controls playsInline preload="metadata" src={material.url} />
          ) : (
            <Paperclip size={18} />
          )}
          <span>{getMaterialTitle(material)}</span>
          <button
            type="button"
            onClick={() => setDetails(details === material.id ? null : material.id)}
            aria-expanded={details === material.id}
            aria-label={`整理素材：${getMaterialTitle(material)}`}
          >
            <MoreHorizontal size={18} />
          </button>
          {details === material.id && (
            <>
              <label className="now-material__description">
                <span className="sr-only">素材说明（选填）</span>
                <input
                  aria-label={`素材说明（选填）：${getMaterialTitle(material)}`}
                  value={material.description ?? ''}
                  maxLength={240}
                  placeholder="说明（选填）"
                  onChange={(event) => onUpdateDescription(material.id, event.target.value)}
                />
              </label>
              {material.type === 'link' && (
                <button
                  type="button"
                  className="now-material__replace-link"
                  onClick={() => onReplaceLink(material.id)}
                  aria-label={`更换链接：${getMaterialTitle(material)}`}
                >
                  <LinkIcon size={15} />
                  更换链接
                </button>
              )}
              {onMove && index > 0 && (
                <button
                  type="button"
                  onClick={() => onMove(material.id, -1)}
                  aria-label={`上移素材：${getMaterialTitle(material)}`}
                >
                  上移
                </button>
              )}
              {onMove && index < materials.length - 1 && (
                <button
                  type="button"
                  onClick={() => onMove(material.id, 1)}
                  aria-label={`下移素材：${getMaterialTitle(material)}`}
                >
                  下移
                </button>
              )}
              <button type="button" onClick={() => onRemove(material.id)} aria-label="删除素材">
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      ))}
      {activeIndex >= 0 && (
        <div
          ref={viewerRef}
          className="now-image-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="查看图片"
        >
          <button type="button" autoFocus onClick={() => setViewing(null)}>
            关闭
          </button>
          {activeIndex > 0 && (
            <button
              type="button"
              onClick={() => setViewing(images[activeIndex - 1].id)}
              aria-label="上一张"
            >
              <ChevronLeft />
            </button>
          )}
          <img src={images[activeIndex].url} alt={getMaterialAlt(images[activeIndex])} />
          {activeIndex < images.length - 1 && (
            <button
              type="button"
              onClick={() => setViewing(images[activeIndex + 1].id)}
              aria-label="下一张"
            >
              <ChevronRight />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const AudioPreview: React.FC<{ material: Material }> = ({ material }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  return (
    <div className="now-audio-preview">
      <button
        type="button"
        className="now-audio-play-button"
        onClick={() => void audioRef.current?.play()}
      >
        {getAudioPlayLabel()}
      </button>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- user-recorded audio has no caption track */}
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        src={material.url}
        data-mime-type={material.meta?.mime_type}
      />
    </div>
  );
};
