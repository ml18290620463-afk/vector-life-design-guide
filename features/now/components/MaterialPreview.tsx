import React, { useRef } from 'react';
import { Paperclip, Trash2 } from 'lucide-react';
import type { Material } from '../types/now';
import { getAudioPlayLabel, getMaterialAlt, getMaterialTitle } from '../../../lib/materialDisplay';

interface MaterialPreviewProps {
  materials: Material[];
  onRemove: (id: string) => void;
}

export const MaterialPreview: React.FC<MaterialPreviewProps> = ({ materials, onRemove }) => {
  if (materials.length === 0) return null;
  return (
    <div className="now-materials">
      {materials.map((material) => (
        <div key={material.id} className="now-material">
          {material.type === 'image' && material.url ? (
            <img src={material.url} alt={getMaterialAlt(material)} />
          ) : material.type === 'audio' && material.url ? (
            <AudioPreview material={material} />
          ) : material.type === 'video' && material.url ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- user-uploaded video has no caption track
            <video controls playsInline preload="metadata" src={material.url} />
          ) : (
            <Paperclip size={18} />
          )}
          <span>{getMaterialTitle(material)}</span>
          <button type="button" onClick={() => onRemove(material.id)} aria-label="删除素材">
            <Trash2 size={16} />
          </button>
        </div>
      ))}
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
