import type { ChatMessage } from '../types/now';

export interface AvatarSummarizeResponse {
  text: string;
  mood_tags: string[];
  event_tags: string[];
  is_sparse: boolean;
  followup_question: string | null;
  can_summarize?: boolean;
  reason?: string;
}

export const summarizeAvatarMessages = async (args: {
  messages: ChatMessage[];
  record_time: string;
  followup_round: number;
}): Promise<AvatarSummarizeResponse> => {
  const response = await fetch('/api/v1/avatar/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error('avatar-summarize-failed');
  return (await response.json()) as AvatarSummarizeResponse;
};
