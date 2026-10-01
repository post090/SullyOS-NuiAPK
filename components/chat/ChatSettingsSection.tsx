import React, { useId, useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';

/** Compact counterpart of the Settings app's sections; each group starts collapsed. */
export default function ChatSettingsSection({ title, summary, children }: {
    title: string;
    summary: string;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const contentId = useId();
    return (
        <section className="rounded-2xl border border-slate-200/80 bg-white" data-chat-settings-section={title}>
            <button type="button" aria-expanded={open} aria-controls={contentId}
                onClick={() => setOpen(value => !value)}
                className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-primary">
                <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-700">{title}</span>
                    <span className="mt-1 block text-[10px] leading-relaxed text-slate-400">{summary}</span>
                </span>
                <CaretDown aria-hidden="true" size={14} weight="bold" className={`shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
            </button>
            <div id={contentId} hidden={!open} className="space-y-5 border-t border-slate-100 px-4 py-4">
                {children}
            </div>
        </section>
    );
}
