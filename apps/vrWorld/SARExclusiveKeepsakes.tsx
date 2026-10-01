import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookmarkSimple } from '@phosphor-icons/react';
import type { FishingMarketState } from '../../utils/vrWorld/fishingMarket';
import { sarExclusiveKeepsakes } from '../../utils/vrWorld/sarKeepsakes';
import { SAR_NPC_NAMES } from '../../utils/vrWorld/sarArt';
import { SARFamiliarityKeepsake } from './SARFamiliarityKeepsake';
import { SARPageNav } from './SARCharacterPicker';
import { FishArt } from './FishArt';
import { SARArtifactPreview } from './SARArtifactArt';
import './sar-exclusive-keepsakes.css';

export function SARExclusiveKeepsakes({ market, backRef, onDetailChange }: { market: FishingMarketState; onDetailChange: (title:string|null)=>void; backRef: React.MutableRefObject<(() => boolean) | null> }) {
    const entries = useMemo(() => sarExclusiveKeepsakes(market), [market]);
    const scroll = useRef<HTMLElement>(null);
    const [filter, setFilter] = useState<'all' | 'caian' | 'aiven'>('all');
    const [selectedId, setSelectedId] = useState<string | null>(null), [page, setPage] = useState(0);
    const selected = entries.find(item => item.id === selectedId);
    const matches = entries.filter(item => filter === 'all' || item.npc === filter);
    const pages = Math.max(1, Math.ceil(matches.length / 12)), currentPage = Math.min(page, pages - 1);
    useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; }, [filter, currentPage, selectedId]);
    useEffect(() => { onDetailChange(selected?.title||null); return ()=>onDetailChange(null); }, [selected?.title,onDetailChange]);
    useEffect(() => { backRef.current = () => { if (!selectedId) return false; setSelectedId(null); return true; }; return () => { backRef.current = null; }; }, [selectedId]);
    useEffect(() => {
        const host = window as Window & { render_game_to_text?: () => string };
        const render = () => JSON.stringify({ mode: 'sar-exclusive-keepsakes', filter, selectedId, page: currentPage + 1, pages, entries: matches.map(item => ({ id: item.id, title: item.title, npc: item.npc })) });
        host.render_game_to_text = render;
        return () => { if (host.render_game_to_text === render) delete host.render_game_to_text; };
    }, [entries, filter, selectedId, currentPage]);
    if (selected?.souvenir) return <SARFamiliarityKeepsake embedded item={selected.souvenir} onClose={() => setSelectedId(null)}/>;
    return <>
        <main ref={scroll} className="sar-hub-warehouse sar-exclusive-shelf">
            {selected ? <article className="sar-collection-entry">
                {selected.speciesId && <div className="sar-collection-large-art is-collected"><FishArt speciesId={selected.speciesId} size={165}/></div>}
                <div className="sar-exclusive-source">{SAR_NPC_NAMES[selected.npc]} · {selected.source}</div><p>{selected.description}</p>
                <p className="sar-hub-muted">{selected.owned ? '已经放在你的恐龙收藏里，可以去箱庭单独起名、换色和摆放。' : '这份专属赠礼的收录仍然留在这里。'}</p>
            </article> : <>
                <div className="sar-exclusive-intro"><BookmarkSimple size={29} weight="light"/><div><h3>为你留的那一份</h3><p>纪念卡、合影与特别的赠礼。打开它，就能回看当时留下的细节。</p></div></div>
                <nav className="sar-exclusive-filters" aria-label="纪念物来自谁">{(['all', 'caian', 'aiven'] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(0); }}>{value === 'all' ? '全部' : SAR_NPC_NAMES[value]}</button>)}</nav>
                <div className="sar-exclusive-count">已收好 {matches.length} 份纪念</div>
                <div className="sar-exclusive-items">{matches.slice(currentPage * 12, (currentPage + 1) * 12).map(item => <button type="button" className="sar-exclusive-item" key={item.id} onClick={() => setSelectedId(item.id)}>
                    <span className="sar-exclusive-art">{item.speciesId ? <FishArt speciesId={item.speciesId} size={72}/> : <SARArtifactPreview kind={item.artifactKind || 'memory-card'}/>}</span>
                    <span><small>{SAR_NPC_NAMES[item.npc]} · 专属赠礼</small><strong>{item.title}</strong><span>{item.source}</span></span>
                </button>)}</div>
                {!matches.length && <div className="sar-hub-empty"><BookmarkSimple size={40} weight="light"/><h3>这一页，先为你留着</h3><p>一起经历故事后收到的专属纪念物，会收在这里。</p></div>}
                <SARPageNav page={currentPage} pages={pages} onChange={setPage} label="专属纪念"/>
            </>}
        </main>
    </>;
}
