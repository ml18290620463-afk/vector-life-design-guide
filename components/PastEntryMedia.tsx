import React, { useRef } from 'react';
import { FileText } from 'lucide-react';
import type { DiaryEntry, Language, Theme } from '../types';
import {
  isLegacyMediaMaterial,
  splitEntryContent,
  stripLegacyMaterialPrefix,
} from '../lib/entryContent';
import { getEntryMediaGroups } from '../lib/entryMedia';
import { getAudioPlayLabel, getMaterialAlt, getMaterialTitle } from '../lib/materialDisplay';

type PastEntryMediaVariant = 'archive' | 'mobile';

interface PastEntryMediaProps {
  entry: DiaryEntry;
  variant: PastEntryMediaVariant;
  theme?: Theme;
  language?: Language;
  compact?: boolean;
}

const stopPropagation = (event: React.MouseEvent) => event.stopPropagation();

const ArchiveAttachmentPreview: React.FC<{
  entry: DiaryEntry;
  theme: Theme;
  compact: boolean;
}> = ({ entry, theme, compact }) => {
  if (!entry.attachment) return null;

  if (entry.attachment.type === 'image') {
    return (
      <figure className={compact ? 'mt-3' : 'mt-4'}>
        <img
          src={entry.attachment.data}
          alt={entry.attachment.name}
          loading="lazy"
          className={`w-full rounded-lg border object-cover ${
            compact ? 'max-h-56' : 'max-h-80'
          } ${theme === 'light' ? 'border-slate-200 bg-slate-100' : 'border-cyan-900/30 bg-black/30'}`}
        />
      </figure>
    );
  }

  if (entry.attachment.type === 'video') {
    return (
      <figure className={compact ? 'mt-3' : 'mt-4'}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- user-uploaded video has no caption track */}
        <video
          src={entry.attachment.data}
          controls
          playsInline
          preload="metadata"
          className="archive-entry-attachment-media"
          onClick={stopPropagation}
        />
      </figure>
    );
  }

  if (entry.attachment.type === 'audio') {
    return (
      <div className={compact ? 'mt-3' : 'mt-4'}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- user-recorded audio has no caption track */}
        <audio
          src={entry.attachment.data}
          controls
          preload="metadata"
          className="w-full"
          onClick={stopPropagation}
        />
      </div>
    );
  }

  return (
    <div
      className={`mt-3 inline-flex max-w-full items-center gap-2 rounded-md border px-3 py-2 text-xs ${
        theme === 'light'
          ? 'border-slate-200 bg-slate-50 text-slate-500'
          : 'border-cyan-900/30 bg-black/20 text-cyan-300/70'
      }`}
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{entry.attachment.name}</span>
    </div>
  );
};

const ArchiveInlineMedia: React.FC<{
  entry: DiaryEntry;
  theme: Theme;
  compact: boolean;
}> = ({ entry, theme, compact }) => {
  const { materials: rawMaterials } = splitEntryContent(entry.content);
  const {
    imageMaterials,
    videoMaterials,
    audioMaterials,
    linkMaterials,
    legacyAudioUrls,
    legacyVideoUrls,
    legacyLinkMaterials,
  } = getEntryMediaGroups(entry, rawMaterials);

  if (
    imageMaterials.length === 0 &&
    videoMaterials.length === 0 &&
    audioMaterials.length === 0 &&
    linkMaterials.length === 0 &&
    legacyAudioUrls.length === 0 &&
    legacyVideoUrls.length === 0 &&
    legacyLinkMaterials.length === 0
  ) {
    return null;
  }

  return (
    <div
      className={`archive-entry-media ${compact ? 'archive-entry-media--compact' : ''}`}
    >
      {imageMaterials.map((material) => (
        <img
          key={material.id}
          src={material.url}
          alt={getMaterialAlt(material)}
          loading="lazy"
        />
      ))}
      {videoMaterials.map((material) => (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- user-uploaded video has no caption track
        <video
          key={material.id}
          controls
          playsInline
          preload="metadata"
          src={material.url}
          onClick={stopPropagation}
        />
      ))}
      {legacyVideoUrls.map((url) => (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- user-uploaded video has no caption track
        <video
          key={url}
          controls
          playsInline
          preload="metadata"
          src={url}
          onClick={stopPropagation}
        />
      ))}
      {audioMaterials.map((material) => (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- user-recorded audio has no caption track
        <audio
          key={material.id}
          controls
          preload="metadata"
          src={material.url}
          onClick={stopPropagation}
        />
      ))}
      {legacyAudioUrls.map((url) => (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- user-recorded audio has no caption track
        <audio key={url} controls preload="metadata" src={url} onClick={stopPropagation} />
      ))}
      {[
        ...linkMaterials.map((material) => ({ title: getMaterialTitle(material), url: material.url })),
        ...legacyLinkMaterials.map((link) => ({ title: link, url: link })),
      ].map(({ title, url }) => (
        <a
          key={`${title}-${url}`}
          className={theme === 'light' ? 'archive-entry-media__link--light' : ''}
          href={/^https?:\/\//i.test(url) ? url : undefined}
          target="_blank"
          rel="noreferrer"
          onClick={stopPropagation}
        >
          {title}
        </a>
      ))}
    </div>
  );
};

const MobileAudioPlayback: React.FC<{ src: string; language: Language }> = ({ src, language }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  return (
    <div className="mobile-past-audio">
      <button
        type="button"
        className="mobile-past-audio__label"
        onClick={() => void audioRef.current?.play()}
      >
        {getAudioPlayLabel(language)}
      </button>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- user-recorded audio has no caption track */}
      <audio ref={audioRef} controls preload="metadata" src={src} />
    </div>
  );
};

const MobileLinkMaterialCard: React.FC<{ title: string; url?: string }> = ({ title, url }) => {
  const displayTitle = title.trim() || url || '链接';
  return url ? (
    <a className="mobile-past-link-card" href={url} target="_blank" rel="noreferrer">
      <span>{displayTitle}</span>
    </a>
  ) : (
    <div className="mobile-past-link-card">
      <span>{displayTitle}</span>
    </div>
  );
};

const MobileEntryMedia: React.FC<{ entry: DiaryEntry; language: Language }> = ({
  entry,
  language,
}) => {
  const { materials: rawMaterials } = splitEntryContent(entry.content);
  const materials = rawMaterials.filter((material) => !isLegacyMediaMaterial(material));
  const {
    imageMaterials,
    videoMaterials,
    audioMaterials,
    linkMaterials,
    otherMaterials,
    legacyAudioUrls,
    legacyVideoUrls,
    legacyLinkMaterials,
  } = getEntryMediaGroups(entry, rawMaterials);
  const hasMaterials =
    imageMaterials.length > 0 ||
    videoMaterials.length > 0 ||
    legacyVideoUrls.length > 0 ||
    audioMaterials.length > 0 ||
    legacyAudioUrls.length > 0 ||
    linkMaterials.length > 0 ||
    otherMaterials.length > 0 ||
    materials.length > 0 ||
    Boolean(entry.attachment);

  if (!hasMaterials) return null;

  return (
    <div className="mobile-past-timeline__materials">
      {imageMaterials.length > 0 && (
        <div
          className={`mobile-past-image-gallery ${
            imageMaterials.length > 1 ? 'mobile-past-image-gallery--scroll' : ''
          }`}
          aria-label={language === 'zh' ? '图片素材' : 'Image materials'}
        >
          {imageMaterials.map((material) => (
            <figure key={material.id} className="mobile-past-image">
              <img src={material.url} alt={getMaterialAlt(material, language)} />
            </figure>
          ))}
        </div>
      )}
      {videoMaterials.map((material) => (
        <figure key={material.id} className="mobile-past-video">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- user-uploaded video has no caption track */}
          <video controls playsInline preload="metadata" src={material.url} />
        </figure>
      ))}
      {legacyVideoUrls.map((url) => (
        <figure key={url} className="mobile-past-video">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- user-uploaded video has no caption track */}
          <video controls playsInline preload="metadata" src={url} />
        </figure>
      ))}
      {audioMaterials.map((material) => (
        <MobileAudioPlayback key={material.id} src={material.url} language={language} />
      ))}
      {legacyAudioUrls.map((url) => (
        <MobileAudioPlayback key={url} src={url} language={language} />
      ))}
      {entry.attachment?.type === 'video' && entry.attachment.data && (
        <figure className="mobile-past-video">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- user-uploaded video has no caption track */}
          <video controls playsInline preload="metadata" src={entry.attachment.data} />
        </figure>
      )}
      {entry.attachment?.type === 'audio' && entry.attachment.data && (
        <MobileAudioPlayback src={entry.attachment.data} language={language} />
      )}
      {entry.attachment?.type === 'image' && entry.attachment.data && (
        <div className="mobile-past-image-gallery">
          <figure className="mobile-past-image">
            <img src={entry.attachment.data} alt="图片素材" />
          </figure>
        </div>
      )}
      {entry.attachment && !['image', 'video', 'audio'].includes(entry.attachment.type) && (
        <div className="mobile-past-material">
          {entry.attachment.type}: {entry.attachment.name}
        </div>
      )}
      {linkMaterials.map((material) => (
        <MobileLinkMaterialCard
          key={material.id}
          title={getMaterialTitle(material, language)}
          url={material.url}
        />
      ))}
      {otherMaterials.map((material) => (
        <div key={material.id} className="mobile-past-material">
          {getMaterialTitle(material, language)}
        </div>
      ))}
      {legacyLinkMaterials.map((material) => (
        <MobileLinkMaterialCard key={material} title={material} url={material} />
      ))}
      {materials.map((material) =>
        /^link\s*[:：]/i.test(material) ? null : (
          <div key={material} className="mobile-past-material">
            {stripLegacyMaterialPrefix(material)}
          </div>
        ),
      )}
    </div>
  );
};

/**
 * Shared media / attachment renderer for Past entry previews.
 *
 * The archive and mobile variants intentionally keep their existing class
 * names, but all parsing and legacy-material compatibility now lives in one
 * place. That lets mobile timeline cards and archive cards evolve together
 * when Now adds another material type.
 */
export const PastEntryMedia: React.FC<PastEntryMediaProps> = ({
  entry,
  variant,
  theme = 'dark',
  language = 'zh',
  compact = false,
}) => {
  if (variant === 'mobile') {
    return <MobileEntryMedia entry={entry} language={language} />;
  }

  return (
    <>
      <ArchiveAttachmentPreview entry={entry} theme={theme} compact={compact} />
      <ArchiveInlineMedia entry={entry} theme={theme} compact={compact} />
    </>
  );
};
