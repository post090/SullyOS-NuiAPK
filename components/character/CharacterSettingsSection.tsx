import React from 'react';

export default function CharacterSettingsSection({ title, summary, children }: {
  title: string; summary?: string; children: React.ReactNode;
}) {
  return <details className="group/section bg-white rounded-3xl border border-slate-100 shadow-sm [&_textarea]:shadow-none">
    <summary className="list-none cursor-pointer flex items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-bold text-slate-700">{title}</span>
        {summary && <span className="block text-[11px] text-slate-400 mt-1 truncate">{summary}</span>}
      </span>
      <span aria-hidden="true" className="text-slate-400 transition-transform group-open/section:rotate-90">›</span>
    </summary>
    <div className="border-t border-slate-100 [&>div]:border-0 [&>div]:shadow-none">{children}</div>
  </details>;
}
