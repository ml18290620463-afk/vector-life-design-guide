import React from 'react';
import { MessageCircleMore } from 'lucide-react';
import { GUIDANCE_STARTERS } from '../../../services/avatarGuidance';

export function AvatarGuidanceStarters({ onChoose }: { onChoose: (prompt: string) => void }) {
  return (
    <section className="now-avatar-invitation" aria-label="开聊方向">
      <div className="now-avatar-invitation__starters" aria-label="选择一个开聊方向">
        {GUIDANCE_STARTERS.map((prompt) => (
          <button type="button" key={prompt} onClick={() => onChoose(prompt)}>
            <MessageCircleMore size={16} aria-hidden="true" />
            <span>{prompt}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
