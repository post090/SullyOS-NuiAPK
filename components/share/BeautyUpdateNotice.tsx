import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './BeautyConfirmDialog.css';

export const BEAUTY_CATALOG_NOTICE = 'sully-beauty-catalog-notice-v1';
export const BEAUTY_AUTHOR_NOTICE = 'sully-beauty-author-notice-v1';
export function needsBeautyNotice(key: string) {
  try { return localStorage.getItem(key) !== 'seen'; } catch { return true; }
}
export default function BeautyUpdateNotice({ author = false, onClose }: { author?: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => {
    try { localStorage.setItem(author ? BEAUTY_AUTHOR_NOTICE : BEAUTY_CATALOG_NOTICE, 'seen'); } catch { /* 本次仍可关闭 */ }
    onClose();
  };
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
  return createPortal(<dialog ref={ref} className="beauty-confirm-dialog" aria-label={author ? '给美化作者的新功能' : '装扮库上线啦'} onCancel={event => { event.preventDefault(); close(); }}>
    <h3>{author ? '给美化作者的新功能' : '装扮库上线啦'}</h3>
    <div className="beauty-confirm-body">{author ? <>
      <p>你提交过的作品，现在可以由你决定是否放进装扮库，供大家搜索、预览和领取。</p>
      <p>原有作品不会自动公开。在「我的提交 → 选择文件更新」中勾选「允许公开展示」，补上封面并提交，审核通过后才会进入装扮库。</p>
      <p>「我的提交」还支持单独或批量修改协议，包括二改、转载与反馈约定，无需重新选文件。修改后仍需人工审核，通常需要 1–2 天；通过后原分享码提供新版本。</p>
      <p>也可以取消公开展示。目录缓存会稍后更新，已下载的副本无法收回。</p>
    </> : <>
      <p>聊天装扮新增「装扮库（测试版）」入口，可以按分类和名称搜索作者公开的作品，查看效果后再领取到自己的收藏。</p>
      <p>列表先显示封面，点开作品后可按需体验交互预览。审核后更新目录，再次进入或点「刷新目录」即可查看新上架的作品。</p>
      <p>只有作者同意公开且审核通过的作品才会展示；领取前记得查看作者的使用约定。</p>
    </>}</div>
    <footer><button autoFocus onClick={close}>知道了</button></footer>
  </dialog>, document.body);
}
