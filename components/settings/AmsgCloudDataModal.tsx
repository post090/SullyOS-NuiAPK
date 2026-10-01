/**
 * 云端数据清点。
 *
 * 在这之前，用户对自己那台 worker 只有两个动作：整个清空，或者什么都不管。而云端按
 * 角色堆着定时任务、完整的角色上下文（角色卡加最近 30 条对话原文）和几行 API 凭据，
 * 本地删过角色、导过别人的备份、在另一台设备上清过一轮，都会留下再没人认领的那一份，
 * 角色命名空间在 worker 侧又没有 TTL——不主动看一眼，永远不知道它在那儿。
 *
 * 这个界面只做两件事：把云端有什么列出来，以及清掉用户亲手勾中的那些。
 *
 * **不自动清。** 「孤儿」的判据是「本地没有这个角色」，而同一台 worker 可能被两台设备
 * 共用——这台眼里的孤儿正是另一台正在用的角色。所以默认勾选只是省几下点击，真正动手
 * 的永远是用户自己那一下。
 */

import React, { useCallback, useEffect, useState } from 'react';
import Modal from '../os/Modal';
import ConfirmDialog from '../os/ConfirmDialog';
import type { CharacterProfile } from '../../types';
import { purgeCloudCharById } from '../../utils/amsg2CharCleanup';
import {
  collectCloudInventory,
  formatCloudSize,
  type CloudCharEntry,
  type CloudInventory,
} from '../../utils/amsgCloudInventory';
import { readDetachedWorkers } from '../../utils/amsgDetachedWorkers';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  characters: CharacterProfile[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const shortCharId = (charId: string) => charId.replace(/^char-/, '').slice(-8);

/** 一行角色在云端占了些什么，拼成一句话。 */
const describeEntry = (entry: CloudCharEntry): string => {
  const parts: string[] = [];
  if (entry.taskCount > 0) parts.push(`${entry.taskCount} 个定时任务`);
  if (entry.instantCount > 0) parts.push(`${entry.instantCount} 轮对话进行中`);
  if (entry.state) {
    parts.push(entry.state.entryCount > 0
      ? `上下文 ${formatCloudSize(entry.state.byteSize)}`
      : '没有上下文');
  }
  if (entry.credPurposes.length > 0) parts.push(`${entry.credPurposes.length} 行 API 凭据`);
  return parts.length > 0 ? parts.join(' · ') : '没有占用';
};

const CharRow: React.FC<{
  entry: CloudCharEntry;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}> = ({ entry, checked, disabled, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    disabled={disabled}
    className={`w-full flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors disabled:opacity-60 ${
      checked ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'
    }`}
  >
    <span
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
        checked ? 'border-rose-400 bg-rose-500 text-white' : 'border-slate-300 bg-white text-transparent'
      }`}
      aria-hidden
    >
      ✓
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-bold text-slate-700">
        {entry.local ? entry.local.name : `已删除的角色 ${shortCharId(entry.charId)}`}
      </span>
      <span className="mt-0.5 block text-xs text-slate-500">{describeEntry(entry)}</span>
    </span>
  </button>
);

const AmsgCloudDataModal: React.FC<Props> = ({ isOpen, onClose, characters, addToast }) => {
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<CloudInventory | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [purging, setPurging] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detached, setDetached] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await collectCloudInventory(characters);
      setInventory(next);
      // 孤儿默认勾上（它们是这个界面存在的理由），还在用的角色一个都不预选——
      // 清掉在用角色的上下文虽然能自愈，但那是用户要自己权衡的事。
      setSelected(new Set(next.orphans.map((entry) => entry.charId)));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
      setInventory(null);
    } finally {
      setLoading(false);
    }
  }, [characters]);

  // 只在打开那一刻拉一次：命名空间清单要在 worker 上按用户扫一遍 client_state，
  // 做成自动刷新就是白扫 D1。用户想重看有「重新清点」。
  useEffect(() => {
    if (!isOpen) return;
    setDetached(readDetachedWorkers().map((record) => record.url));
    void load();
  }, [isOpen, load]);

  const toggle = (charId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(charId)) next.delete(charId);
      else next.add(charId);
      return next;
    });
  };

  const selectedLiveCount = inventory
    ? inventory.live.filter((entry) => selected.has(entry.charId)).length
    : 0;

  const runPurge = async () => {
    setConfirmOpen(false);
    setPurging(true);
    let cleared = 0;
    const failed: string[] = [];
    try {
      for (const charId of selected) {
        const result = await purgeCloudCharById(charId);
        if (result.status === 'failed') failed.push(charId);
        else cleared += 1;
      }
      if (failed.length > 0) {
        addToast(`清掉了 ${cleared} 个，还有 ${failed.length} 个没清成，可以再试一次。`, 'error');
      } else {
        addToast(`已清掉 ${cleared} 个角色在云端的数据。`, 'success');
      }
      await load();
    } finally {
      setPurging(false);
    }
  };

  const busy = loading || purging;

  return (
    <>
      <Modal
        isOpen={isOpen}
        title="云端数据"
        onClose={onClose}
        footer={
          <div className="flex w-full gap-2">
            <button
              onClick={onClose}
              disabled={purging}
              className="flex-1 rounded-2xl bg-slate-100 py-3 font-bold text-slate-600 disabled:opacity-50"
            >
              关闭
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={busy || selected.size === 0}
              className="flex-1 rounded-2xl bg-rose-500 py-3 font-bold text-white shadow-lg shadow-rose-200 disabled:opacity-40"
            >
              {purging ? '清理中…' : `清理选中 (${selected.size})`}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {loading && (
            <p className="py-6 text-center text-sm text-slate-400">正在问云端要清单…</p>
          )}

          {!loading && loadError && (
            <div className="space-y-2 rounded-2xl border border-rose-100 bg-rose-50 p-4">
              <p className="text-sm font-bold text-rose-600">读不到云端清单</p>
              <p className="text-xs text-rose-500 break-all">{loadError}</p>
              <button
                onClick={() => void load()}
                className="w-full rounded-xl bg-white py-2 text-sm font-bold text-rose-600"
              >
                再试一次
              </button>
            </div>
          )}

          {!loading && inventory && (
            <>
              {inventory.orphans.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-bold text-slate-700">本地已经没有的角色</h3>
                    <span className="text-xs text-rose-500">{inventory.orphans.length} 个</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    这些角色在本地找不到了，云端那份再没有人会刷新或清掉它。如果你在别的设备上还用着同一台
                    Worker，先确认那边也不要了再清。
                  </p>
                  <div className="space-y-2">
                    {inventory.orphans.map((entry) => (
                      <CharRow
                        key={entry.charId}
                        entry={entry}
                        checked={selected.has(entry.charId)}
                        disabled={busy}
                        onToggle={() => toggle(entry.charId)}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-bold text-slate-700">还在用的角色</h3>
                  <span className="text-xs text-slate-400">{inventory.live.length} 个</span>
                </div>
                {inventory.live.length === 0 ? (
                  <p className="text-xs text-slate-400">云端还没有这些角色的数据。</p>
                ) : (
                  <>
                    <p className="text-xs text-slate-500">
                      清掉只是丢掉云端那份缓存，下次聊天或排程会重新传一份。但 ta 名下已经排好的定时任务
                      到点会失败一次，直到你再聊一轮把上下文补回去。
                    </p>
                    <div className="space-y-2">
                      {inventory.live.map((entry) => (
                        <CharRow
                          key={entry.charId}
                          entry={entry}
                          checked={selected.has(entry.charId)}
                          disabled={busy}
                          onToggle={() => toggle(entry.charId)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </section>

              {inventory.globals.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-700">不属于某个角色的</h3>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    {inventory.globals.map((item) => (
                      <div key={item.namespace} className="flex items-baseline justify-between py-0.5 text-xs">
                        <span className="truncate text-slate-600">{describeGlobalNamespace(item.namespace)}</span>
                        <span className="shrink-0 pl-2 text-slate-400">{formatCloudSize(item.usage.byteSize)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    工具凭据、天气热搜缓存和后台活儿的一次性输入。它们不按角色分，要清请用「清空云端数据」。
                  </p>
                </section>
              )}

              {inventory.gaps.length > 0 && (
                <section className="space-y-1 rounded-2xl border border-amber-100 bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-700">这份清单不是全集</p>
                  {inventory.gaps.map((gap) => (
                    <p key={gap.kind} className="text-xs text-amber-600">
                      {gapLabel(gap.kind)}：{gap.message}
                    </p>
                  ))}
                </section>
              )}

              {detached.length > 0 && (
                <section className="space-y-1 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-600">你还断开过这些 Worker</p>
                  {detached.map((url) => (
                    <p key={url} className="break-all text-xs text-slate-500">{url}</p>
                  ))}
                  <p className="text-xs text-slate-400">
                    断开时没有动那边的数据。要清的话，把地址填回上面的配置里，连上之后再来这一页。
                  </p>
                </section>
              )}

              <button
                onClick={() => void load()}
                disabled={busy}
                className="w-full rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-500 disabled:opacity-50"
              >
                重新清点
              </button>
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="清掉这些角色的云端数据"
        message={
          selectedLiveCount > 0
            ? `选中的 ${selected.size} 个里有 ${selectedLiveCount} 个是还在用的角色。清掉之后它们的定时任务到点会失败一次，直到你再跟 ta 聊一轮。确定继续吗？`
            : `将清掉这 ${selected.size} 个角色在云端的上下文、API 凭据和定时任务。此操作不可撤销。`
        }
        confirmText="清理"
        cancelText="取消"
        variant="danger"
        onConfirm={() => void runPurge()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};

const gapLabel = (kind: string): string => {
  if (kind === 'tasks') return '任务清单没读到';
  if (kind === 'credentials') return '凭据清单没读到';
  return '命名空间清单没读到';
};

/** 全局命名空间的人话名字；认不出来的就照原样显示。 */
const describeGlobalNamespace = (namespace: string): string => {
  if (namespace === 'amsg:global') return '工具凭据与实时世界缓存';
  if (namespace === 'amsg:job') return '后台活儿的一次性输入';
  return namespace;
};

export default AmsgCloudDataModal;
