import { lazy } from 'react';

let avatarChatModule: Promise<{ default: typeof import('./components/AvatarChatPage').AvatarChatPage }> | undefined;

const loadAvatarChatPage = () =>
  (avatarChatModule ??= import('./components/AvatarChatPage').then((module) => ({ default: module.AvatarChatPage })));

/** Starts the chat chunk fetch when the user signals that they intend to open their avatar. */
export const preloadAvatarChatPage = () => loadAvatarChatPage();

export const AvatarChatPage = lazy(loadAvatarChatPage);
