export type MaterialType = 'image' | 'video' | 'link' | 'audio';

export interface Material {
  id: string;
  type: MaterialType;
  url: string;
  local_path?: string;
  meta?: {
    width?: number;
    height?: number;
    duration_ms?: number;
    mime_type?: string;
    title?: string;
  };
  sort_order: number;
}

export interface NowDraft {
  text: string;
  materials: Material[];
  mood_tags: string[];
  event_tags: string[];
  record_time: string;
  display_time: string;
  updated_at: string;
}

export interface NowRecord {
  id?: string;
  created_at: string;
  display_time: string;
  text: string | null;
  materials: Material[];
  mood_tags: string[];
  event_tags: string[];
  source: 'manual' | 'avatar_assisted';
  avatar_session_id?: string | null;
  sync_status?: 'synced' | 'pending';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  type: 'text' | 'audio' | 'record_preview';
  content: string;
  audio_url?: string;
  created_at: string;
  payload?: RecordPreviewPayload;
}

export interface RecordPreviewPayload {
  text: string;
  mood_tags: string[];
  event_tags: string[];
  record_time: string;
  display_time: string;
  is_sparse: boolean;
}

export type NowRoute = 'now' | 'tags' | 'avatar-chat';
