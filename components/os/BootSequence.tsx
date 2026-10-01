import React from 'react';
import type { OSTheme } from '../../types';
import ClassicBootSequence from './ClassicBootSequence';
import JellyfishBootSequence from './JellyfishBootSequence';
import { isMidAutumnBoot } from '../../utils/seasonalBoot';

interface Props {
  dataReady: boolean;
  wallpaper?: string;
  style?: OSTheme['bootAnimationStyle'];
  onDone: () => void;
}
export default function BootSequence({style, ...props}: Props) {
  // 一次开屏固定同一张图；下次进入重新判断，到期恢复用户选择的样式。
  const [midAutumn] = React.useState(() => isMidAutumnBoot());
  if (midAutumn) return <JellyfishBootSequence {...props} poster={`${import.meta.env.BASE_URL}boot/mid-autumn-2026.png`} />;
  return style === 'classic' ? <ClassicBootSequence {...props} /> : <JellyfishBootSequence {...props} />;
}
