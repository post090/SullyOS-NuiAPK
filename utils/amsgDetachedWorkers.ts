/**
 * 断开过的 Worker 地址备忘。
 *
 * 清空或更换 Worker 地址都不会动云端那份数据——这两个动作没有毁灭的意味，换反代端点、
 * 换自定义域名走的也是同一条路，背后往往还是同一台 worker、同一个 D1，照着「地址变了」
 * 就去清，等于把用户正在用的数据删了。真要清有专门的入口（设置页的「清空云端数据」），
 * 那是用户亲手点的。
 *
 * 但地址一换，本地就再没有别的地方记得上一个地址了，而那台 worker 上的定时任务照样到点
 * 跑、照样烧 API 额度、照样往这台设备推消息。这本备忘就是回去的门：记下地址和断开时间，
 * 用户想清的时候知道该填哪个地址。
 *
 * 只记地址和时间，不记共享密钥和主密钥。那两样是钥匙，存在这里没有对应的用途——这份
 * 记录只够「提醒你那边还留着东西」，真要连回去清，密钥还得用户自己填。
 */

const LS_KEY = 'amsg2_detached_workers_v1';
/** 留最近几条就够了：再往前的地址用户自己也认不出来是哪台。 */
const MAX_ENTRIES = 5;

export interface DetachedWorkerRecord {
  /** 断开时那个 Worker 地址。 */
  url: string;
  /** 断开时间（epoch ms）。 */
  detachedAt: number;
}

const isRecord = (value: unknown): value is DetachedWorkerRecord =>
  !!value
  && typeof value === 'object'
  && typeof (value as DetachedWorkerRecord).url === 'string'
  && !!(value as DetachedWorkerRecord).url
  && typeof (value as DetachedWorkerRecord).detachedAt === 'number';

/** 读备忘，最近断开的排在前面。读坏了当没有（这本账丢了不影响任何功能）。 */
export const readDetachedWorkers = (): DetachedWorkerRecord[] => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord).sort((a, b) => b.detachedAt - a.detachedAt);
  } catch {
    return [];
  }
};

/**
 * 记一笔「这个地址断开了」。
 *
 * 同一个地址反复断开只留最新那次：用户关心的是「那边还有没有东西」，不是断过几回。
 */
export const rememberDetachedWorker = (url: string | undefined | null): void => {
  const trimmed = url?.trim();
  if (!trimmed) return;
  try {
    const next = [
      { url: trimmed, detachedAt: Date.now() },
      ...readDetachedWorkers().filter((record) => record.url !== trimmed),
    ].slice(0, MAX_ENTRIES);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    // 写不进去就算了：这本账是给用户的提示，不该因为存储满了而打断正在进行的操作。
  }
};

/** 用户已经把那台清干净了（或者确认不用管了），从备忘里划掉。 */
export const forgetDetachedWorker = (url: string): void => {
  try {
    const remaining = readDetachedWorkers().filter((record) => record.url !== url);
    if (remaining.length === 0) localStorage.removeItem(LS_KEY);
    else localStorage.setItem(LS_KEY, JSON.stringify(remaining));
  } catch {
    /* 同上，失败无所谓 */
  }
};
