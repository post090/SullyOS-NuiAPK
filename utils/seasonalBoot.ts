// 2026 中秋限定：按东八区的绝对边界判断，不跟随设备或角色时区。
const MID_AUTUMN_START = Date.parse('2026-09-25T00:00:00+08:00');
const MID_AUTUMN_END = Date.parse('2026-09-28T00:00:00+08:00');

export const isMidAutumnBoot = (timestamp = Date.now()): boolean =>
  timestamp >= MID_AUTUMN_START && timestamp < MID_AUTUMN_END;
