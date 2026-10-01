export const formatBytes = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

/**
 * 备份文件名用的可读时间戳：YYYY-MM-DD_HH-MM-SS（本地时区）。
 *
 * 为什么不用 Date.now() 毫秒戳：用户看不懂，本地存了一堆数字结尾的 zip
 * 根本分不出哪份是哪天的。
 *
 * 为什么不用 ISO 字符串（2026-07-20T15:30:45.000Z）：
 *   1. T 和 : 在 Windows / 部分 ROM 文件名里是非法字符
 *   2. ISO 是 UTC，国内用户看到 8 小时偏移会困惑
 *
 * 用本地时区 + 0 填充 + 下划线分隔：字典序 = 时间序，WebDAV 按文件名倒序排
 * 也能正确把最新备份排在最前面。
 */
export const formatBackupTimestamp = (d: Date = new Date()): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
       + `_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
};

/**
 * 金额按「分」收敛：浮点相加会攒出 49.85999999999999 这样的尾巴，
 * 展示或写进文本前都先过这里，保证只到分位。
 */
export const roundMoney = (value: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};

/** 一串金额求和，结果已收敛到分位 */
export const sumMoney = (values: number[]): number =>
  roundMoney(values.reduce((sum, v) => sum + (Number(v) || 0), 0));

/** 金额显示：整数不带小数点，小数最多两位（49.859999… → 49.86，100 → 100） */
export const formatMoney = (value: number): string => String(roundMoney(value));

/**
 * 分钟按小时显示：界面上给的是整档，但持久化里的值可能是导入的备份、
 * 老版本写进去的任意整数，除以 60 会拖出 1.6666666666666667。
 */
export const formatHours = (minutes: number): string => {
  const n = Number(minutes);
  if (!Number.isFinite(n)) return '0';
  return String(Math.round((n / 60) * 10) / 10);
};
