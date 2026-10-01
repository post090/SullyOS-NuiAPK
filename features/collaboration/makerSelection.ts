import { COLLABORATION_MAKER_MAP } from './makers';
import type { CollaborationMakerKind } from './types';

export const makerDraftSeed = (kind: CollaborationMakerKind) =>
  `请和我一起做「${COLLABORATION_MAKER_MAP[kind].label}」。我希望它的感觉是：`;

/** Only replace untouched helper text; a user's own draft belongs to them. */
export function changeMakerSelection(current: CollaborationMakerKind | undefined, requested: CollaborationMakerKind | undefined, draft: string) {
  const makerKind = requested === current ? undefined : requested;
  const isHelper = !!current && draft.trim() === makerDraftSeed(current);
  return { makerKind, draft: !draft.trim() || isHelper ? (makerKind ? makerDraftSeed(makerKind) : '') : draft };
}
