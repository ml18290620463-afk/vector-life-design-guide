import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { PastActionDialog } from './PastActionDialog';

export function PastImage({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  return (
    <>
      <span className="past-image-preview">
        <img {...props} src={src} alt={alt ?? ''} />
        <button
          className="past-image-preview__open"
          type="button"
          aria-label={`查看图片：${alt || '图片'}`}
          onClick={(event) => {
            event.stopPropagation();
            setZoomed(false);
            setOpen(true);
          }}
        />
      </span>
      {open &&
        createPortal(
          <PastActionDialog
            title={alt || '图片'}
            className="past-image-dialog"
            onCancel={() => setOpen(false)}
          >
            <div className="past-image-viewer" data-zoomed={zoomed}>
              <img src={src} alt={alt ?? ''} />
            </div>
            <div className="past-action-dialog__actions">
              <button
                type="button"
                aria-pressed={zoomed}
                onClick={() => setZoomed((value) => !value)}
              >
                {zoomed ? '适应窗口' : '放大'}
              </button>
              <button type="button" data-cancel onClick={() => setOpen(false)}>
                关闭
              </button>
            </div>
          </PastActionDialog>,
          document.body,
        )}
    </>
  );
}
