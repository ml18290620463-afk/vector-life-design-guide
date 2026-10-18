import { expect, it } from 'vitest';
import { selfMemoryVoice } from './avatarMemoryVoice';
import { parseAvatarFacts } from '../server/avatarFactExtraction';

it('uses the owner’s voice without rewriting product terms', () => {
  expect(selfMemoryVoice('用户偏好安静的环境')).toBe('我偏好安静的环境');
  expect(selfMemoryVoice('用户可能在压力下先独处')).toBe('我可能在压力下先独处');
  expect(selfMemoryVoice('我重视用户体验')).toBe('我重视用户体验');
  expect(selfMemoryVoice('用户体验需要改善')).toBe('用户体验需要改善');
});

it('normalizes generated memories while preserving source evidence', () => {
  const content = '我偏好安静的环境';
  const [fact] = parseAvatarFacts(JSON.stringify({ candidates: [{
    statement: '用户偏好安静的环境', kind: 'preference', sourceIndexes: [0], evidences: [content],
  }] }), [{ role: 'user', content }]);
  expect(fact.statement).toBe(content);
  expect(fact.evidences).toEqual([content]);
});
