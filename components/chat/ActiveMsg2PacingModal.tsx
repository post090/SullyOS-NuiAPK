import React, { useEffect, useState } from 'react';
import Modal from '../os/Modal';
import {
  type AmsgPacingSettings,
  DEFAULT_MAX_ACTIVE_TASKS,
  DEFAULT_MAX_UNANSWERED_SENDS,
  DEFAULT_MIN_SEND_GAP_MINUTES,
  DEFAULT_RECURRING_STOP_AFTER,
  describeMinutes,
  MAX_ACTIVE_TASKS_CEILING,
  resolveAmsgLimits,
} from '../../utils/amsgLimits';

/**
 * 「主动频率」：用户给这个角色定的几条上限（主动消息 2.0 面板里点「调整」打开）。
 *
 * 单独成一页、自带保存按钮：这几项跟「新建任务」那张表单不是一回事，挤在一起的话，
 * 底部按钮只能是「新建任务」，改个上限就得顺手建一条任务才存得下来。
 *
 * 文案只说「会怎样」，不讲实现：用户要知道的是「到了上限会跳过、不补发」「你手动排的
 * 算不算」，不需要知道这些闸在哪一层拦。
 */

interface ActiveMsg2PacingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 当前保存着的设置（没设的项 = 用默认值）。 */
  initial: AmsgPacingSettings;
  /** TA 现在排着几次每天/每周重复的消息（关掉「可以排重复的」时会一起取消）。 */
  selfRecurringTaskCount: number;
  /** 保存。返回 true 关掉这一页；false 表示没存成、留在原处（调用方负责提示）。 */
  onSubmit: (next: AmsgPacingSettings) => Promise<boolean>;
}

/** 下拉框的值：'' = 跟默认值走（存 undefined），其余是数字的字符串。 */
type SelectValue = string;

const toSelect = (value: number | undefined): SelectValue => (value === undefined ? '' : String(value));
const fromSelect = (value: SelectValue): number | undefined => (value === '' ? undefined : Number(value));

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const GAP_OPTIONS = [5, 10, 20, 30, 60, 120, 180];
const DAILY_CAP_OPTIONS = [1, 2, 3, 5, 8, 10, 15, 20, 30];

const selectClass = 'w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm';

const Field: React.FC<{ label: string; hint: string; children: React.ReactNode; warning?: string | null }> = ({
  label, hint, children, warning,
}) => (
  <div>
    <div className="font-bold text-slate-700 text-sm mb-1.5 pl-1">{label}</div>
    {children}
    <p className="text-xs text-slate-400 mt-1.5 pl-1 leading-relaxed">{hint}</p>
    {warning ? <p className="text-xs text-amber-600 mt-1 pl-1 leading-relaxed">{warning}</p> : null}
  </div>
);

const Toggle: React.FC<{ on: boolean; onClick: () => void }> = ({ on, onClick }) => (
  <button
    onClick={onClick}
    className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${on ? 'bg-fuchsia-500' : 'bg-slate-200'}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

const ActiveMsg2PacingModal: React.FC<ActiveMsg2PacingModalProps> = ({
  isOpen, onClose, initial, selfRecurringTaskCount, onSubmit,
}) => {
  const [maxUnanswered, setMaxUnanswered] = useState<SelectValue>('');
  const [minGap, setMinGap] = useState<SelectValue>('');
  const [dailyCap, setDailyCap] = useState<SelectValue>('');
  const [recurringStop, setRecurringStop] = useState<SelectValue>('');
  const [maxTasks, setMaxTasks] = useState<SelectValue>('');
  const [allowRecurring, setAllowRecurring] = useState(false);
  const [allowForce, setAllowForce] = useState(false);
  const [saving, setSaving] = useState(false);

  // 每次打开都从保存值重新填：上次没保存就关掉的改动不该留着。只认「打开」这一下：
  // initial 跟着角色配置走，这一页开着时角色在聊天里排了条任务，配置对象就换了一个，
  // 跟着它重填的话用户正在改的几项会被悄悄冲掉。
  useEffect(() => {
    if (!isOpen) return;
    const resolved = resolveAmsgLimits(initial);
    setMaxUnanswered(toSelect(initial.maxUnansweredSends));
    setMinGap(toSelect(initial.minSendGapMinutes));
    // 每日上限的 0 和「没设」是同一个意思（不限），下拉里只留一个「不限」。
    setDailyCap(initial.dailySendCap ? String(initial.dailySendCap) : '');
    setRecurringStop(toSelect(initial.recurringStopAfter));
    setMaxTasks(toSelect(initial.maxActiveTasks));
    setAllowRecurring(resolved.allowSelfRecurring);
    setAllowForce(resolved.allowSelfForce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const wasAllowingRecurring = resolveAmsgLimits(initial).allowSelfRecurring;
  const willCancelRecurring = wasAllowingRecurring && !allowRecurring && selfRecurringTaskCount > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      const closed = await onSubmit({
        maxUnansweredSends: fromSelect(maxUnanswered),
        minSendGapMinutes: fromSelect(minGap),
        dailySendCap: fromSelect(dailyCap),
        recurringStopAfter: fromSelect(recurringStop),
        maxActiveTasks: fromSelect(maxTasks),
        allowSelfRecurring: allowRecurring,
        allowSelfForce: allowForce,
      });
      if (closed) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title="主动频率"
      onClose={onClose}
      footer={(
        <>
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl active:scale-95 transition-transform">
            取消
          </button>
          <button onClick={() => void handleSave()} disabled={saving} className="flex-1 py-3 bg-fuchsia-500 text-white font-bold rounded-2xl active:scale-95 transition-transform disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
        </>
      )}
    >
      <div className="space-y-5 text-sm text-slate-600">
        <p className="text-xs leading-relaxed text-slate-500">
          这里管的是 TA 主动来找你的消息。你们正常聊天时 TA 的回复不算在内。
        </p>

        <div className="space-y-4">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pl-1">多久找你一次</label>

          <Field
            label="你没回时，最多连着找你几次"
            hint="一次可以是好几句话。TA 自己排的后续都算在里面，你回一句就重新数。到了上限，TA 排的后续到点会直接跳过、不补发。你自己排的不受影响。想让 TA 在你睡着时隔一阵报备一句的话，就调大些。"
            warning={maxUnanswered === '0' ? '选了不限，你不回的时候 TA 可以一直接着找你，每一次都要消耗 API 额度。' : null}
          >
            <select value={maxUnanswered} onChange={(e) => setMaxUnanswered(e.target.value)} className={selectClass}>
              <option value="">默认（{DEFAULT_MAX_UNANSWERED_SENDS} 次）</option>
              {range(1, 10).map((n) => <option key={n} value={String(n)}>{n} 次</option>)}
              <option value="0">不限</option>
            </select>
          </Field>

          <Field
            label="两次之间至少隔多久"
            hint="只管 TA 自己排的，免得接连不断地刷屏。"
          >
            <select value={minGap} onChange={(e) => setMinGap(e.target.value)} className={selectClass}>
              <option value="">默认（{describeMinutes(DEFAULT_MIN_SEND_GAP_MINUTES)}）</option>
              {GAP_OPTIONS.map((m) => <option key={m} value={String(m)}>{describeMinutes(m)}</option>)}
              <option value="0">不限制</option>
            </select>
          </Field>

          <Field
            label="每天最多主动找你几次"
            hint="你手动排的也算在内（写好固定内容的那种不算）。到了上限，当天剩下的会跳过、不补发，第二天重新数。"
          >
            <select value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} className={selectClass}>
              <option value="">不限（默认）</option>
              {DAILY_CAP_OPTIONS.map((n) => <option key={n} value={String(n)}>{n} 次</option>)}
            </select>
          </Field>

          <Field
            label="重复的消息，连续几次没回就先停"
            hint="对每天、每周重复的消息生效，你手动排的也算（写好固定内容的那种不算）。停下以后，你回一句话它就会恢复。"
          >
            <select value={recurringStop} onChange={(e) => setRecurringStop(e.target.value)} className={selectClass}>
              <option value="">默认（{DEFAULT_RECURRING_STOP_AFTER} 次）</option>
              {range(1, 10).map((n) => <option key={n} value={String(n)}>{n} 次</option>)}
              <option value="0">不停</option>
            </select>
          </Field>

          <Field
            label="最多同时排好几次"
            hint="你和 TA 排的共用这些名额，每天、每周重复的只算一次。"
          >
            <select value={maxTasks} onChange={(e) => setMaxTasks(e.target.value)} className={selectClass}>
              <option value="">默认（{DEFAULT_MAX_ACTIVE_TASKS} 次）</option>
              {range(1, MAX_ACTIVE_TASKS_CEILING).map((n) => <option key={n} value={String(n)}>{n} 次</option>)}
            </select>
          </Field>
        </div>

        <div className="space-y-3 pt-1 border-t border-slate-100">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pl-1 pt-3">TA 自己能排什么</label>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pl-1">
              <div className="font-bold text-slate-700">可以排每天、每周重复的消息</div>
              <div className="text-xs text-slate-400 mt-1 leading-relaxed">关着时 TA 只能排一次性的。</div>
              {willCancelRecurring ? (
                <div className="text-xs text-amber-600 mt-1 leading-relaxed">
                  TA 排过 {selfRecurringTaskCount} 次重复消息，保存后会一起取消。
                </div>
              ) : null}
            </div>
            <Toggle on={allowRecurring} onClick={() => setAllowRecurring(!allowRecurring)} />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pl-1">
              <div className="font-bold text-slate-700">可以排「到点必发」的消息</div>
              <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                比如答应了 8 点叫你起床，到点你正好在跟 TA 聊天也照发。关着时，碰上这种情况 TA 会改成在聊天里自然提起。
              </div>
            </div>
            <Toggle on={allowForce} onClick={() => setAllowForce(!allowForce)} />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default React.memo(ActiveMsg2PacingModal);
