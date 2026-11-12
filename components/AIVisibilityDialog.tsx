import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PastActionDialog } from './PastActionDialog';
import type { AIVisibility } from '../services/aiPrivacy';

export function useAIVisibilityChoice(language: string = 'zh', futureContent: boolean | 'principle' | 'memory' = false) {
  const [open, setOpen] = useState(false);
  const [wholeRecord, setWholeRecord] = useState(false);
  const resolve = useRef<((value: AIVisibility | null) => void) | null>(null);
  useEffect(
    () => () => {
      resolve.current?.(null);
      resolve.current = null;
    },
    [],
  );
  const finish = (value: AIVisibility | null) => {
    resolve.current?.(value);
    resolve.current = null;
    setOpen(false);
  };
  const request = (whole = false) =>
    new Promise<AIVisibility | null>((done) => {
      if (resolve.current) {
        done(null);
        return;
      }
      resolve.current = done;
      setWholeRecord(whole);
      setOpen(true);
    });
  const zh = language === 'zh';
  const dialog = open ? createPortal((
    <PastActionDialog
      title={zh ? '是否允许 AI 可见？' : 'Allow AI access?'}
      onCancel={() => finish(null)}
      className="ai-visibility-dialog"
    >
      <p>
        {zh
          ? futureContent === 'principle' || futureContent === 'memory'
            ? `请选择这${futureContent === 'principle' ? '条原则' : '条记忆'}的可见范围。每次保存都由你决定；关联来源未授权时，AI 也不能读取这项内容。`
            : futureContent
            ? '本次选择适用于这项未来内容及同步保存的目标反馈。关联愿景或目标仅自己可见时，AI 也不能读取其下的内容。'
            : wholeRecord
              ? '本次选择适用于整条记录，包括原文和全部补充。'
              : '请选择这条记录的可见范围。每次保存都由你决定。'
          : 'Choose access for this record, including all supplements.'}
      </p>
      <div className="ai-visibility-options">
        <button type="button" onClick={() => finish('private')}>
          <strong>{zh ? '仅自己可见' : 'Only me'}</strong>
          <span>
            {zh
              ? '保存内容，AI 不读取、不分析、不用于后续回答。'
              : 'Save without AI reading, analysis or later use.'}
          </span>
        </button>
        <button type="button" onClick={() => finish('allowed')}>
          <strong>{zh ? '允许 AI 可见' : 'Allow AI'}</strong>
          <span>
            {zh
              ? '允许 AI 后续读取、分析和引用，直到你修改权限。'
              : 'Allow future reading, analysis and recall until you revoke access.'}
          </span>
        </button>
      </div>
      <p className="ai-visibility-note">
        {zh
          ? '可在编辑保存时更改。撤回后停止后续使用，无法收回此前已发送给模型的内容。'
          : 'You can change this later. Revocation stops future use but cannot recall data already sent to a model.'}
      </p>
      <div className="past-action-dialog__actions">
        <button type="button" data-cancel onClick={() => finish(null)}>
          {zh ? '返回编辑' : 'Go back'}
        </button>
      </div>
    </PastActionDialog>
  ), document.body) : null;
  return { request, dialog };
}
