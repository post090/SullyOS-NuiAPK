import React, { useMemo, useState } from 'react';
import { CaretLeft, CaretRight, MagnifyingGlass } from '@phosphor-icons/react';
import type { CharacterGroup, CharacterProfile } from '../../types';
import TokenImg from '../../components/os/TokenImg';
import './sar-pagination.css';

export function SARPageNav({ page, pages, onChange, label = '列表', showSinglePage = false }: {
    page: number; pages: number; onChange: (page: number) => void; label?: string; showSinglePage?: boolean;
}) {
    if (pages <= 1 && !showSinglePage) return null;
    return <nav className="sar-pages" aria-label={`${label}分页`}>
        <button type="button" disabled={page <= 0} aria-label={`${label}上一页`} onClick={() => onChange(page - 1)}><CaretLeft size={15}/></button>
        <span aria-live="polite">{page + 1} / {pages}</span>
        <button type="button" disabled={page >= pages - 1} aria-label={`${label}下一页`} onClick={() => onChange(page + 1)}><CaretRight size={15}/></button>
    </nav>;
}

const PAGE_SIZE = 8;
export function SARCharacterPicker({ characters, groups = [], selectedId, onSelect, counts }: {
    characters: CharacterProfile[]; groups?: CharacterGroup[]; selectedId: string;
    onSelect: (id: string) => void; counts?: Map<string, number>;
}) {
    const [group, setGroup] = useState('all'), [query, setQuery] = useState(''), [page, setPage] = useState(() => Math.max(0, Math.floor(characters.findIndex(char => char.id === selectedId) / PAGE_SIZE)));
    const validGroups = useMemo(() => new Set(groups.map(item => item.id)), [groups]);
    const filtered = useMemo(() => characters.filter(char =>
        (group === 'all' || (group === 'ungrouped' ? !char.groupId || !validGroups.has(char.groupId) : char.groupId === group))
        && (!query.trim() || char.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))), [characters, group, query, validGroups]);
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), shownPage = Math.min(page, pages - 1);
    const shown = filtered.slice(shownPage * PAGE_SIZE, (shownPage + 1) * PAGE_SIZE);
    return <section className="sar-character-picker" aria-label="按角色查看柜子">
        <div className="sar-character-picker-filters">
            <label><span className="sr-only">角色分组</span><select aria-label="角色分组" value={group} onChange={event => { setGroup(event.target.value); setPage(0); }}>
                <option value="all">全部角色 · {characters.length}</option>
                {groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                <option value="ungrouped">未分组</option>
            </select></label>
            <label><MagnifyingGlass size={15}/><input aria-label="搜索角色" placeholder="找角色" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }}/></label>
        </div>
        <div className="sar-character-picker-grid">{shown.map(char => <button type="button" key={char.id} aria-pressed={selectedId === char.id}
            aria-label={`选择角色 ${char.name}`} onClick={() => onSelect(char.id)}>
            <span className="sar-character-picker-portrait">{char.avatar ? <TokenImg value={char.avatar} alt="" loading="lazy"/> : <i>{char.name.slice(0, 1)}</i>}
                {counts?.has(char.id) && <b>{counts.get(char.id)}</b>}</span>
            <strong>{char.name}</strong>
        </button>)}</div>
        {!shown.length && <p className="sar-character-picker-empty">没有找到角色</p>}
        <SARPageNav page={shownPage} pages={pages} onChange={setPage} label="角色"/>
    </section>;
}
