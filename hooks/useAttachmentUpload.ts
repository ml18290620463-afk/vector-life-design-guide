import { useCallback, useRef, useState } from 'react';
import type { Attachment } from '../types';
import { evaluateAttachmentSize, type AttachmentSizeAssessment } from '../services/diaryStorage';

export interface AttachmentUploadCallbacks {
  /** Reject (hard limit). */
  onTooLarge: () => void;
  /** Soft warning that the attachment is heavy. */
  onLargeWarning: () => void;
  /** Reader / OS error path. */
  onReadError: () => void;
  /** Successful staging callback. */
  onStaged: (attachment: Attachment) => void;
}

const detectAttachmentType = (mime: string): Attachment['type'] => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  return 'other';
};

/**
 * Wraps the FileReader-based attachment upload flow that used to live inline
 * in Dashboard. Returns the input ref to attach to a hidden `<input
 * type="file"/>` plus the change handler and `isUploading` state.
 */
export const useAttachmentUpload = (callbacks: AttachmentUploadCallbacks) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const resetInput = useCallback(() => {
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const { onTooLarge, onLargeWarning, onReadError, onStaged } = callbacks;

  const handleChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const verdict: AttachmentSizeAssessment = evaluateAttachmentSize(file.size);
      if (verdict.verdict === 'reject') {
        onTooLarge();
        resetInput();
        return;
      }
      if (verdict.verdict === 'warn') onLargeWarning();

      setIsUploading(true);
      try {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const base64 = ev.target?.result as string;
          onStaged({
            type: detectAttachmentType(file.type),
            data: base64,
            name: file.name,
            mimeType: file.type,
          });
          setIsUploading(false);
          resetInput();
        };
        reader.onerror = () => {
          onReadError();
          setIsUploading(false);
          resetInput();
        };
        reader.readAsDataURL(file);
      } catch {
        onReadError();
        setIsUploading(false);
        resetInput();
      }
    },
    [onLargeWarning, onReadError, onStaged, onTooLarge, resetInput],
  );

  return {
    inputRef,
    isUploading,
    handleChange,
  };
};
