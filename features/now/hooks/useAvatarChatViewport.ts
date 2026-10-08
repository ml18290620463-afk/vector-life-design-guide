import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { ChatMessage } from '../types/now';

const MESSAGE_WINDOW = 60;
const NEAR_BOTTOM_OFFSET = 72;

/** Renders a conversation in manageable windows without dropping stored messages. */
export const useAvatarChatViewport = (
  messages: ChatMessage[],
  chatListRef: RefObject<HTMLElement | null>,
) => {
  const [firstVisibleIndex, setFirstVisibleIndex] = useState(() =>
    Math.max(0, messages.length - MESSAGE_WINDOW),
  );
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const previousMessageCount = useRef(messages.length);
  const wasNearBottom = useRef(true);

  const updateScrollState = useCallback(() => {
    const list = chatListRef.current;
    const nearBottom =
      !list || list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_OFFSET;
    wasNearBottom.current = nearBottom;
    setShowJumpToLatest(!nearBottom);
  }, [chatListRef]);

  useEffect(() => {
    const list = chatListRef.current;
    if (!list) return;
    list.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();
    return () => list.removeEventListener('scroll', updateScrollState);
  }, [chatListRef, updateScrollState]);

  useEffect(() => {
    const previousStart = Math.max(0, previousMessageCount.current - MESSAGE_WINDOW);
    if (messages.length > previousMessageCount.current && firstVisibleIndex === previousStart) {
      setFirstVisibleIndex(Math.max(0, messages.length - MESSAGE_WINDOW));
    }
    previousMessageCount.current = messages.length;
  }, [firstVisibleIndex, messages.length]);

  useEffect(() => {
    const list = chatListRef.current;
    if (list && wasNearBottom.current) list.scrollTop = list.scrollHeight;
  }, [chatListRef, firstVisibleIndex, messages]);

  const showEarlier = useCallback(() => {
    const list = chatListRef.current;
    const heightBefore = list?.scrollHeight ?? 0;
    setFirstVisibleIndex((current) => Math.max(0, current - MESSAGE_WINDOW));
    const schedule =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (callback: FrameRequestCallback) => setTimeout(callback, 0);
    schedule(() => {
      if (list) list.scrollTop += list.scrollHeight - heightBefore;
    });
  }, [chatListRef]);

  const jumpToLatest = useCallback(() => {
    const list = chatListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
    wasNearBottom.current = true;
    setShowJumpToLatest(false);
  }, [chatListRef]);

  return {
    hiddenMessageCount: firstVisibleIndex,
    visibleMessages: messages.slice(firstVisibleIndex),
    showEarlier,
    showJumpToLatest,
    jumpToLatest,
  };
};
