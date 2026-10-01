import React, { useState } from 'react';
import type { Message } from '../../types';
import { useBlobRefUrl } from '../../utils/blobRef';
import { readAudioDescription } from '../../utils/audioApi';

const formatSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${bytes || 0} B`;
};

const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
};

const ChatAudioBubble: React.FC<{ message: Message; selectionMode: boolean }> = ({ message, selectionMode }) => {
    const url = useBlobRefUrl(message.content || undefined);
    const [showHeard, setShowHeard] = useState(false);
    const fileName = String(message.metadata?.fileName || '音频');
    const size = Number(message.metadata?.fileSize || 0);
    const duration = Number(message.metadata?.duration || 0);
    const heard = readAudioDescription(message);
    const detail = [duration > 0 ? formatDuration(duration) : '', size > 0 ? formatSize(size) : ''].filter(Boolean).join(' · ');

    return (
        <div className="sully-audio-msg w-[min(268px,72vw)] overflow-hidden rounded-[18px] border border-rose-100 bg-white text-left shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3 px-3.5 pt-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-rose-50 text-rose-500" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                    </svg>
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-slate-800">{fileName}</span>
                    {detail && <span className="mt-0.5 block text-[10px] font-medium text-slate-400">{detail}</span>}
                </span>
            </div>
            <div className={`px-3 pb-2 pt-2 ${selectionMode ? 'pointer-events-none' : ''}`}>
                {url ? (
                    <audio controls preload="metadata" src={url} className="h-9 w-full" aria-label={`播放 ${fileName}`} />
                ) : (
                    <div className="py-2 text-center text-[11px] italic text-slate-400">{message.content ? '加载中…' : '[音频已丢失]'}</div>
                )}
            </div>
            {heard && (
                <div className="border-t border-rose-50 px-3.5 py-2">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowHeard(v => !v); }}
                        aria-expanded={showHeard}
                        className="text-[10px] font-semibold tracking-wide text-rose-400"
                    >
                        {showHeard ? '收起识别结果' : '角色听到了什么'}
                    </button>
                    {showHeard && <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-500">{heard}</p>}
                </div>
            )}
        </div>
    );
};

export default ChatAudioBubble;
