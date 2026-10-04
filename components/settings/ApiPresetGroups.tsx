import React from 'react';
import type { ApiPreset } from '../../types';

/** Shared preset library: Settings manages entries; character dialogs only load drafts. */
export default function ApiPresetGroups({ presets, children }: {
  presets: ApiPreset[];
  children: (preset: ApiPreset) => React.ReactNode;
}) {
  const groups = new Map<string, ApiPreset[]>();
  for (const preset of presets) {
    const group = preset.group?.trim() || '未分组';
    groups.set(group, [...(groups.get(group) || []), preset]);
  }
  if (!presets.some(p => p.group?.trim())) {
    return <div className="flex flex-wrap gap-2">{presets.map(children)}</div>;
  }
  return <div className="space-y-2">{[...groups].map(([name, items]) => (
    <details key={name} open className="group/presets">
      <summary className="cursor-pointer text-xs text-slate-500 py-2">{name} · {items.length}</summary>
      <div className="flex flex-wrap gap-2 pb-2">{items.map(children)}</div>
    </details>
  ))}</div>;
}
