import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { clear, get, set } from 'idb-keyval';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AvatarMemoryLibrary } from './AvatarMemoryLibrary';
import { cognition, evidenceGraph } from '../../../tests/fixtures/avatarOntology';
import { AVATAR_ONTOLOGY_KEY } from '../../../services/avatarOntologyKey';
import { DiaryStorageKeys as K } from '../../../services/diaryStorage';
import { initializeAvatarOntology, readAvatarOntology, type AvatarOntologySnapshot } from '../../../services/avatarOntologyStore';
import { useAppStore } from '../../../stores/appStore';
import type { CognitiveObject } from '../../avatar/types';
import type { DiaryEntry } from '../../../types';
import * as archive from '../../../services/avatarOntologyArchive';

const entries: DiaryEntry[] = [1, 2].map(day => ({
  id: `e${day}`, title: '', content: '我喜欢安静，也会提前准备', tags: [],
  createdAt: Date.UTC(2026, 0, day), aiVisibility: 'allowed', isLocked: false,
}));
const pending = (id = 'p', statement = '我喜欢安静') => cognition({
  id, lineageId: id, domain: 'about_me', category: 'preferences_boundaries',
  status: 'candidate', confirmedAt: undefined, statement,
  evidenceGate: { requiresMultiSourceGate: false, independentExperienceCount: 0, distinctUserMessageCount: 0, distinctDateCount: 0, distinctSessionCount: 0, isReadyForConfirmation: false },
});
const confirmed = (overrides: Partial<CognitiveObject> = {}) => cognition({
  ...pending(overrides.id ?? 'p'), status: 'confirmed', confirmedAt: new Date(0).toISOString(),
  evidenceGate: { requiresMultiSourceGate: false, independentExperienceCount: 2,
    distinctUserMessageCount: 0, distinctDateCount: 2, distinctSessionCount: 0,
    isReadyForConfirmation: true }, ...overrides,
});
const choosePrivate = () => fireEvent.click(within(screen.getByRole('dialog', {
  name: '是否允许 AI 可见？',
})).getByRole('button', { name: /仅自己可见/ }));
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const openPending = (count = 1) => click(`待确认 · ${count}`);
const search = (value: string) => fireEvent.change(screen.getByRole('searchbox'), { target: { value } });

beforeEach(async () => {
  await clear(); localStorage.clear();
  useAppStore.setState({ masterPassword: null, isUnlocked: true });
  await initializeAvatarOntology();
});
afterEach(() => vi.restoreAllMocks());
async function setup(objects: CognitiveObject[], customize?: (graph: AvatarOntologySnapshot) => void) {
  const graph = evidenceGraph(objects, entries);
  for (const object of graph.objects) object.evidenceGate.requiresMultiSourceGate = object.domain === 'my_understanding';
  customize?.(graph);
  await set(K.entries, entries);
  await set(AVATAR_ONTOLOGY_KEY, graph);
  const toast = vi.fn(); const revise = vi.fn().mockResolvedValue(undefined); const refresh = vi.fn();
  function Harness() {
    const [current, update] = useState(graph);
    return <AvatarMemoryLibrary graph={current} entries={entries} showToast={toast}
      onAdd={vi.fn()} onRevise={revise} onRefresh={() => {
        refresh(); void readAvatarOntology().then(update);
      }} />;
  }
  render(<Harness />);
  return { graph, toast, revise, refresh };
}

it('excludes candidates from confirmed search and keeps failed reviews retryable', async () => {
  const { toast, refresh } = await setup([pending()]);
  search('安静'); expect(screen.queryByText('我喜欢安静')).toBeNull(); search('');
  openPending(); click('我喜欢安静');
  const failed = vi.spyOn(archive, 'reviewArchiveCognition').mockRejectedValueOnce(new Error('write failed'));
  click('确认记住'); choosePrivate();
  await waitFor(() => expect(toast).toHaveBeenCalledWith('保存失败，请重试'));
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: '记忆内容' })).toHaveValue('我喜欢安静');
  failed.mockRestore(); click('确认记住'); choosePrivate();
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect((await readAvatarOntology()).objects[0]).toMatchObject({ status: 'confirmed', privacy: { aiVisible: false } });
});
it('confirms cognition without mirroring it into Future or principles', async () => {
  await setup([pending()]);
  const future = await get(K.future); const principles = await get(K.principles);
  openPending(); click('确认记住'); choosePrivate();
  await waitFor(async () => expect((await readAvatarOntology()).objects[0].status).toBe('confirmed'));
  expect(await get(K.future)).toEqual(future); expect(await get(K.principles)).toEqual(principles);
});
it('filters native about-me categories without duplicating or hiding pending items', async () => {
  await setup([confirmed(), confirmed({ id: 'role', category: 'foundation_situation', statement: '我是一名设计师' }), pending('waiting', '待确认的偏好')]);
  click(/偏好与边界/);
  expect(screen.getByRole('button', { name: /我喜欢安静/ })).toBeInTheDocument();
  expect(screen.queryByText('我是一名设计师')).toBeNull();
  click('返回'); click(/基础与处境/);
  expect(screen.getByRole('button', { name: /我是一名设计师/ })).toBeInTheDocument();
  openPending(); expect(screen.getByText('待确认的偏好')).toBeInTheDocument();
});
it('searches across the whole library and keeps the query while switching scopes', async () => {
  await setup([confirmed(), confirmed({ id: 'pattern', domain: 'my_understanding', category: 'understanding_judgment', statement: '我会提前准备' })]);
  search('准备'); expect(screen.getByRole('button', { name: /我会提前准备/ })).toBeInTheDocument();
  click('我的认识'); expect(screen.getByRole('searchbox')).toHaveValue('准备');
  expect(screen.getByRole('button', { name: /我会提前准备/ })).toBeInTheDocument();
  click('返回'); click(/理解与判断/); search('准备'); click('返回');
  expect(screen.getByRole('searchbox')).toHaveValue('');
});
it('filters confirmed cognition across domains by record tag', async () => {
  await setup([confirmed({ id: 'self' }), confirmed({ id: 'pattern', domain: 'my_understanding', category: 'understanding_judgment', statement: '我会提前准备' })], graph => {
    graph.edges.push({ id: 'tag-self', schemaVersion: 2, type: 'SCOPED_IN', fromId: 'self', toId: 'tag:工作', tagLabel: '工作', bindingSource: 'inherited_from_evidence', evidenceWeight: 1, createdAt: new Date().toISOString() });
    graph.edges.push({ id: 'tag-pattern', schemaVersion: 2, type: 'SCOPED_IN', fromId: 'pattern', toId: 'tag:工作', tagLabel: '工作', bindingSource: 'inherited_from_evidence', evidenceWeight: 1, createdAt: new Date().toISOString() });
  });
  click('#工作');
  expect(screen.getByRole('button', { name: /我喜欢安静/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /我会提前准备/ })).toBeInTheDocument();
});
it('does not offer reconfirmation or inflate evidence on confirmed cognition', async () => {
  const { graph } = await setup([confirmed()]);
  click(/偏好与边界/); click(/我喜欢安静/);
  expect(screen.queryByRole('button', { name: /准确|仍适用|确认记住/ })).toBeNull();
  click('关闭'); expect(await readAvatarOntology()).toEqual(graph);
});
it('rejects cognition while preserving original records and evidence', async () => {
  const { graph } = await setup([confirmed()]);
  click(/偏好与边界/); click(/我喜欢安静/); click('暂不采用'); click('暂不采用');
  await waitFor(async () => expect((await readAvatarOntology()).objects[0].status).toBe('rejected'));
  expect((await readAvatarOntology()).edges).toEqual(graph.edges);
  expect(await get(K.entries)).toEqual(entries);
});
it('routes confirmed edits through fresh extraction rather than direct mutation', async () => {
  const { graph, revise } = await setup([confirmed()]);
  click(/偏好与边界/); click(/我喜欢安静/); click('调整表述');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '我偏好独处' } });
  click('保存修改'); await waitFor(() => expect(revise).toHaveBeenCalledWith(graph.objects[0], '我偏好独处'));
  expect(await readAvatarOntology()).toEqual(graph);
});
it('routes candidate edits through re-verification and keeps failed edits available', async () => {
  const { graph, revise, toast } = await setup([pending()]);
  revise.mockRejectedValueOnce(new Error('verification failed'));
  openPending(); click('我喜欢安静');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '我偏好独处' } });
  click('确认记住'); await waitFor(() => expect(toast).toHaveBeenCalledWith('保存失败，请重试'));
  expect(screen.getByRole('textbox')).toHaveValue('我偏好独处');
  expect(await readAvatarOntology()).toEqual(graph);
});
it('shows confirmed revisions as revisions, never proof of growth or manual additions', async () => {
  await setup([confirmed({ id: 'before', lineageId: 'before', status: 'superseded', statement: '以前偏好独处' }),
    confirmed({ id: 'after', statement: '现在偏好协作', version: 2, lineageId: 'before' })], graph => {
    graph.edges.push({ id: 'revision', schemaVersion: 2, type: 'SUPERSEDES', fromId: 'after', toId: 'before', confirmedByUserAt: new Date().toISOString(), createdAt: new Date().toISOString() });
  });
  click('我的变化');
  expect(screen.getByText(/不代表已经证明的成长/)).toBeInTheDocument();
  expect(screen.getByText('此前看法')).toBeInTheDocument();
  expect(screen.getByText('以前偏好独处')).toBeInTheDocument();
  expect(screen.getByText('最新认识')).toBeInTheDocument();
  expect(screen.getByText('现在偏好协作')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '新增记忆' })).toBeNull();
});
it('retains deleted-source cognition without displaying unavailable evidence', async () => {
  await setup([confirmed({ status: 'retained_after_source_delete', privacy: { sensitivity: 'normal', aiVisible: false, traceabilityDegraded: true } })], graph => { graph.edges = []; });
  click(/偏好与边界/); click(/我喜欢安静/);
  expect(screen.getByText(/因此不再显示经历依据/)).toBeInTheDocument();
  expect(screen.queryByText('出处摘录')).toBeNull();
});
it('supports inline rejection with no consent dialog and no source deletion', async () => {
  await setup([pending()]); openPending(); click('忽略');
  await waitFor(async () => expect((await readAvatarOntology()).objects[0].status).toBe('rejected'));
  expect(screen.queryByRole('dialog')).toBeNull(); expect(await get(K.entries)).toEqual(entries);
});
it('does not silently expire old candidates', async () => {
  const { graph } = await setup([pending()]); openPending();
  expect(screen.getByText('我喜欢安静')).toBeInTheDocument();
  expect(await readAvatarOntology()).toEqual(graph);
});
it('confirms the visible pending batch only after one explicit privacy choice', async () => {
  await setup([pending('first'), pending('second', '我会提前准备')]);
  openPending(2);
  click('一键确认');
  expect((await readAvatarOntology()).objects.every(object => object.status === 'candidate')).toBe(true);
  choosePrivate();
  await waitFor(async () => expect((await readAvatarOntology()).objects.map(object => object.status))
    .toEqual(['confirmed', 'confirmed']));
  expect((await readAvatarOntology()).objects.every(object => !object.privacy.aiVisible)).toBe(true);
});
it('reviews one candidate at a time, preserves cancelled consent, and never adopts the remaining queue', async () => {
  await setup([pending('first'), pending('second', '我会提前准备')]);
  openPending(2); click('逐条审核 (2)'); click('确认记住');
  const consent = screen.getByRole('dialog', { name: '是否允许 AI 可见？' });
  fireEvent.click(within(consent).getByRole('button', { name: '返回编辑' }));
  await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('我喜欢安静'));
  expect((await readAvatarOntology()).objects.every(object => object.status === 'candidate')).toBe(true);
  click('确认记住'); choosePrivate();
  await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('我会提前准备'));
  click('关闭');
  expect((await readAvatarOntology()).objects.map(object => object.status)).toEqual(['confirmed', 'candidate']);
});
