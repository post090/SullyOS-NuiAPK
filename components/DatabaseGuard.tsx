import React, { useEffect, useState } from 'react';
import { openDB } from '../utils/db';
import { checkDatabaseReadable, databaseFailure, subscribeDatabaseFailure, type DatabaseFailure } from '../utils/databaseHealth';
import { BUILD_LABEL } from '../utils/buildInfo';
import { databaseOpenDiagnostic } from '../utils/databaseOpenDiagnostics';
import './DatabaseGuard.css';

export default function DatabaseGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<DatabaseFailure | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  useEffect(() => {
    let active = true, failed = false;
    const fail = (error: unknown) => {
      if (!active) return;
      failed = true;
      setFailure(databaseFailure(error));
      setReady(false);
    };
    const unsubscribe = subscribeDatabaseFailure(fail);
    void checkDatabaseReadable(openDB).then(() => {
      if (active && !failed) setReady(true);
    }, fail);
    return () => { active = false; unsubscribe(); };
  }, []);

  if (ready && !failure) return <>{children}</>;
  const duplicateIndex = failure?.message.includes('Index with the same ID already exists');
  const diagnostic = failure ? [
    'SullyOS 本地数据库诊断', `构建：${BUILD_LABEL}`,
    `页面：${location.origin}${location.pathname}`, `浏览器：${navigator.userAgent}`,
    `错误：${failure.name}: ${failure.message}`,
    databaseOpenDiagnostic(),
  ].join('\n') : '';
  return <main className="database-guard" aria-busy={!failure}>
    <section aria-labelledby="database-guard-title">
      <span className="database-guard-label">SULLYOS · 本地存档</span>
      <h1 id="database-guard-title">{failure ? '暂时无法读取本地数据' : '正在读取本地数据…'}</h1>
      {failure ? <>
        <p role="alert">读取失败不代表数据已被清空。主界面已暂停加载，请先保留当前浏览器和原访问网址。</p>
        {duplicateIndex && <p>浏览器报告数据库内部索引冲突。目前无法确认存档是否完整；清理网站数据无法保留原存档。</p>}
        <ul>
          <li>不要清除网站数据、卸载浏览器或用空备份覆盖已有备份。</li>
          <li>可关闭同站点的其他标签页与桌面入口，再重试；持续失败请保留现场并反馈诊断。</li>
        </ul>
        <div className="database-guard-actions">
          <button type="button" onClick={() => location.reload()}>重新读取</button>
          <a href={`${import.meta.env.BASE_URL}recover.html`}>检查网页更新</a>
        </div>
        <details open>
          <summary>诊断信息（不含聊天、角色或密钥）</summary>
          <textarea aria-label="数据库诊断" readOnly value={diagnostic} />
          <button type="button" onClick={async () => {
            try { await navigator.clipboard.writeText(diagnostic); setCopyStatus('已复制，可发给开发者排查'); }
            catch { setCopyStatus('请长按或选中上方文字复制'); }
          }}>复制诊断</button>
          <span role="status">{copyStatus}</span>
        </details>
      </> : <p>确认存档可读取后再打开桌面，请稍候。</p>}
    </section>
  </main>;
}
