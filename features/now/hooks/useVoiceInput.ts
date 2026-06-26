import { useCallback, useRef, useState } from 'react';
import type { Material } from '../types/now';

export interface PendingVoiceCapture {
  id: string;
  url: string;
  durationMs: number;
}

const makeId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `material-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const useVoiceInput = (args: {
  onTranscription: (text: string) => void;
  onAudioMaterial: (material: Material) => void;
  onError: (message: string) => void;
}) => {
  const [recording, setRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [pendingCapture, setPendingCapture] = useState<PendingVoiceCapture | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices?.getUserMedia?.({ audio: true });
      streamRef.current = stream ?? null;
      startedAtRef.current = Date.now();
      chunksRef.current = [];
      if (stream && typeof MediaRecorder !== 'undefined') {
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.start();
        recorderRef.current = recorder;
      }
      setPendingCapture(null);
      setDurationMs(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        if (startedAtRef.current) setDurationMs(Date.now() - startedAtRef.current);
      }, 250);
    } catch {
      args.onError('麦克风权限被拒绝');
    }
  }, [args]);

  const stop = useCallback(() => {
    if (!recording) return;
    stopTimer();
    const duration = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    startedAtRef.current = null;
    setRecording(false);
    setDurationMs(duration);
    const finalize = () => {
      const blob = chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: recorder?.mimeType || 'audio/webm' }) : null;
      const url = blob ? URL.createObjectURL(blob) : '';
      chunksRef.current = [];
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setPendingCapture({ id: makeId(), url, durationMs: duration });
    };
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = finalize;
      recorder.stop();
    } else {
      finalize();
    }
  }, [recording, stopTimer]);

  const confirmTranscription = useCallback(() => {
    if (!pendingCapture) return;
    args.onTranscription('（语音转写占位）');
    if (pendingCapture.url) URL.revokeObjectURL(pendingCapture.url);
    setPendingCapture(null);
  }, [args, pendingCapture]);

  const confirmAudioMaterial = useCallback(() => {
    if (!pendingCapture) return;
    args.onAudioMaterial({
      id: makeId(),
      type: 'audio',
      url: pendingCapture.url,
      meta: { duration_ms: pendingCapture.durationMs, title: `录音 ${Math.max(1, Math.ceil(pendingCapture.durationMs / 1000))}s` },
      sort_order: 0,
    });
    setPendingCapture(null);
  }, [args, pendingCapture]);

  const discardPendingCapture = useCallback(() => {
    if (pendingCapture?.url) URL.revokeObjectURL(pendingCapture.url);
    setPendingCapture(null);
  }, [pendingCapture]);

  return {
    recording,
    durationMs,
    pendingCapture,
    start,
    stop,
    confirmTranscription,
    confirmAudioMaterial,
    discardPendingCapture,
  };
};
