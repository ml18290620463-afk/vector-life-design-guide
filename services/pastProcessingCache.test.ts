import { beforeEach, expect, it } from 'vitest';
import {
  forgetPastProcessing,
  markPastRecordProcessed,
  PAST_PROCESSING_KEY,
  wasPastRecordProcessed,
} from './pastProcessingCache';

beforeEach(() => localStorage.clear());

it('tracks processing by fingerprint and invalidates the cache after external storage changes', () => {
  expect(markPastRecordProcessed('one', 'first')).toBe(true);
  expect(wasPastRecordProcessed('one', 'first')).toBe(true);
  expect(wasPastRecordProcessed('one', 'second')).toBe(false);
  localStorage.setItem(PAST_PROCESSING_KEY, JSON.stringify([
    { id: 'two', fingerprint: 'second', version: 1 },
  ]));
  expect(wasPastRecordProcessed('one', 'first')).toBe(false);
  expect(wasPastRecordProcessed('two', 'second')).toBe(true);
});

it('forgets a record and its supplement receipts without changing other records', () => {
  markPastRecordProcessed('one', 'first');
  markPastRecordProcessed('supplement', 'later', 'one');
  markPastRecordProcessed('two', 'second');
  expect(forgetPastProcessing(['one'])).toBe(true);
  expect(wasPastRecordProcessed('one', 'first')).toBe(false);
  expect(wasPastRecordProcessed('supplement', 'later')).toBe(false);
  expect(wasPastRecordProcessed('two', 'second')).toBe(true);
});
