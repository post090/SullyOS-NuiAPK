import React, { useEffect, useState } from 'react';
import type { CharacterProfile, ListenSongConfig } from '../../types';
import { filterListenSources, isListenSongEnabled, listListenSources, type ListenSource } from '../../utils/songListening';

interface Props {
    char: CharacterProfile;
    userName: string;
    onChange: (config: ListenSongConfig) => void;
}

const ListenSongSettings: React.FC<Props> = ({ char, userName, onChange }) => {
    const enabled = isListenSongEnabled(char);
    const config = char.listenSongConfig || {};
    const [sources, setSources] = useState<ListenSource[] | null>(null);

    useEffect(() => {
        if (!enabled) return;
        let alive = true;
        listListenSources(char, userName).then(list => { if (alive) setSources(list); }).catch(() => { if (alive) setSources([]); });
        return () => { alive = false; };
    }, [enabled, char.id, char.musicProfile?.updatedAt, userName]);

    const selected = new Set((sources ? filterListenSources(sources, config.sources) : []).map(s => s.key));
    const write = (keys: Set<string>) => onChange({ ...config, sources: (sources || []).filter(s => keys.has(s.key)).map(s => s.key) });
    const toggleSource = (key: string) => {
        const next = new Set(selected);
        if (next.has(key)) next.delete(key); else next.add(key);
        write(next);
    };
    const setGroup = (origin: ListenSource['origin'], on: boolean) => {
        const next = new Set(selected);
        for (const s of sources || []) if (s.origin === origin) { if (on) next.add(s.key); else next.delete(s.key); }
        write(next);
    };
    const songTotal = new Set((sources || []).filter(s => selected.has(s.key)).flatMap(s => s.songs.map(song => song.id))).size;

    const renderGroup = (origin: ListenSource['origin'], heading: string) => {
        const group = (sources || []).filter(s => s.origin === origin);
        if (group.length === 0) return null;
        return (
            <div>
                <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400">{heading}</span>
                    <span className="flex gap-2 text-[10px]">
                        <button type="button" className="text-indigo-500" onClick={() => setGroup(origin, true)}>全选</button>
                        <button type="button" className="text-slate-400" onClick={() => setGroup(origin, false)}>全不选</button>
                    </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {group.map(s => {
                        const on = selected.has(s.key);
                        return (
                            <button
                                key={s.key}
                                type="button"
                                aria-pressed={on}
                                onClick={() => toggleSource(s.key)}
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${on ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500'}`}
                            >
                                {s.title}<span className={on ? 'text-white/70' : 'text-slate-400'}> · {s.songs.length}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="pt-2 border-t border-slate-100">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => onChange({ ...config, enabled: !enabled })}>
                <label className="text-xs font-bold text-slate-400 uppercase pointer-events-none">角色主动听歌</label>
                <div className={`w-10 h-6 rounded-full p-1 transition-colors flex items-center ${enabled ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${enabled ? 'translate-x-4' : ''}`}></div>
                </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                开启后，角色可以从下面勾选的歌单里挑一首，用音频识别 API 真的听完并写听歌日记。每轮最多给角色看 15 首自己的歌和 15 首你的歌，歌多时随机轮换。
            </p>
            {enabled && (
                <div className="mt-3 space-y-3">
                    {sources === null ? (
                        <p className="text-[10px] text-slate-400">正在读取歌单…</p>
                    ) : sources.length === 0 ? (
                        <p className="text-[10px] text-slate-400">还没有可选的歌单。角色歌单在音乐 App 里生成；你的网易云歌单要先在音乐 App 里点开过一次才会被缓存。</p>
                    ) : (
                        <>
                            {renderGroup('char', `${char.name} 的歌单`)}
                            {renderGroup('user', `${userName || '你'} 的歌`)}
                            <p className="text-[10px] text-slate-400">
                                已选 {selected.size} 个来源，共 {songTotal} 首（重复的歌只算一次）。
                                {!config.sources && ' 还没手动选过：默认用全部来源。'}
                            </p>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ListenSongSettings;
