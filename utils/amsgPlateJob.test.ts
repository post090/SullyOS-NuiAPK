import { describe, expect, it } from 'vitest';
import {
  buildPlateJobInput, parsePlateJobInput,
  buildPlateConsolidateResult, parsePlateConsolidateResult,
} from './amsgPlateJob';

const input = () => buildPlateJobInput({
  charId: 'c1', charName: '小满', userName: '小明', identityContext: '',
  rooms: [{ room: 'user_room', entries: ['旧事实'], entryIds: ['e1'] }],
  materials: [{ room: 'user_room', lines: ['新事实'] }],
});
const result = () => buildPlateConsolidateResult({
  jobId: 'j1', charId: 'c1', rooms: input().rooms,
  items: [{ room: 'user_room', text: '新事实', basedOn: 'U0' }],
});

describe('门牌快照时间随任务和结果往返', () => {
  it('保留客户端读快照的时刻，不换成生成或收件时刻', () => {
    const snapshotAt = 1_800_000_000_000;
    const job = parsePlateJobInput(JSON.stringify({ ...input(), snapshotAt }))!;
    const payload = buildPlateConsolidateResult({ ...job, jobId: 'j1', items: result().items });
    expect(parsePlateConsolidateResult(JSON.parse(JSON.stringify(payload))))
      .toHaveProperty('snapshotAt', snapshotAt);
  });

  it('兼容没有快照时间的旧输入与旧结果', () => {
    expect(parsePlateJobInput(input())).toEqual(input());
    expect(parsePlateConsolidateResult(result())).toEqual(result());
  });

  it.each([0, -1, NaN, Infinity, '1800000000000', null, 1.5])(
    '无效快照时间 %s 不用于放宽本地编辑保护', snapshotAt => {
      expect(parsePlateJobInput({ ...input(), snapshotAt })).toEqual(input());
      expect(parsePlateConsolidateResult({ ...result(), snapshotAt })).toEqual(result());
    },
  );
});
