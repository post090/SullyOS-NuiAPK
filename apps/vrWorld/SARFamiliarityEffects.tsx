import { familiarityText } from '../../utils/vrWorld/sarFamiliarity/catalog';
import { createPortal } from 'react-dom';
import { SARObjectInspector } from './SARObjectInspector';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowCounterClockwise, Camera, Check, Cpu, FloppyDisk, IdentificationCard, MagnifyingGlassPlus, Plus, Question, Sparkle, Ticket, Trash, User } from '@phosphor-icons/react';
import TokenImg from '../../components/os/TokenImg';
import roomArt from '../../assets/sar-club-room.png';
import type { FamiliarityEffect, FamiliarityNpc } from '../../utils/vrWorld/sarFamiliarity/types';
import { SARNpcChibi, SARPortrait } from './SARNpcArt';
import { SARArtifactSeal, SARMemoryObject } from './SARArtifactArt';
import { FishArt } from './FishArt';
import { DinoIcon } from './dinosaur/DinoIcon';
import './SARFamiliarityEffects.css';
import './sar-artifacts.css';

export interface SARFamiliarityEffectsProps {
    effect: FamiliarityEffect;
    npc: FamiliarityNpc;
    flags: Record<string, string | boolean>;
    userName: string;
    userChibi?: string;
    characters: Array<{ id: string; name: string; chibi?: string }>;
    draft: Record<string, unknown>;
    onDraftChange: (draft: Record<string, unknown>) => void;
    onEditUserChibi?: () => void;
    replay?: boolean;
    inScene?: boolean;
}

interface PhotoActor { id: string; name: string; chibi?: string; npc?: FamiliarityNpc; x: number; y: number; scale: number }
interface PhotoDraft { actors: PhotoActor[]; background: string; panX: number; panY: number; zoom: number; date?: string }
const BACKGROUNDS = [{ id: 'lounge', label: '沙发旁', position: '50% 49%' }, { id: 'desk', label: '管理员柜台', position: '50% 20%' }, { id: 'water', label: '水边', position: '50% 94%' }];
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const number = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
function dateLabel(draft: Record<string, unknown>) { return typeof draft.date === 'string' ? draft.date : new Date().toLocaleDateString('zh-CN'); }
function discountLabel(effect: FamiliarityEffect) {
    const text = `${effect.title || ''} ${effect.text || ''}`;
    const reduction = text.match(/[-−]\s*(\d+)\s*%/), folded = text.match(/([\d.]+)\s*折/), rate = text.match(/(\d+)\s*%/);
    if (reduction) return String((100 - Number(reduction[1])) / 10);
    if (folded) return folded[1];
    if (/八折/.test(text)) return '8';
    if (/九折/.test(text)) return '9';
    return rate ? String(Number(rate[1]) / 10) : '9';
}
function copy(text: string | undefined, props: SARFamiliarityEffectsProps) {
    return familiarityText(text || '', props.userName, props.flags);
}
function Person({ actor }: { actor: Pick<PhotoActor, 'npc' | 'chibi' | 'name'> }) {
    return actor.npc ? <SARNpcChibi who={actor.npc} /> : actor.chibi ? <TokenImg value={actor.chibi} alt={`${actor.name}的 Q 版形象`} draggable={false} /> : <span className="srf-fx-silhouette"><User size={60} weight="duotone" aria-hidden="true" /><small>{actor.name}</small></span>;
}
function readPhoto(props: SARFamiliarityEffectsProps): PhotoDraft {
    const raw = props.draft.photo as Partial<PhotoDraft> | undefined;
    const defaults: PhotoActor[] = [
        { id: 'caian', name: '凯恩', npc: 'caian', x: 26, y: 86, scale: 1 },
        { id: 'user', name: props.userName, chibi: props.userChibi, x: 50, y: 89, scale: 1 },
        { id: 'aiven', name: '艾文', npc: 'aiven', x: 74, y: 86, scale: 1 },
    ];
    const stored = Array.isArray(raw?.actors) ? raw.actors.filter(actor => actor && typeof actor.id === 'string' && typeof actor.name === 'string') : defaults;
    const seen = new Set<string>();
    const actors: PhotoActor[] = stored.filter(actor => { if (seen.has(actor.id)) return false; seen.add(actor.id); return true; }).slice(0, 10).map(actor => ({
        ...actor, npc: actor.npc === 'caian' || actor.npc === 'aiven' ? actor.npc : undefined,
        chibi: actor.id === 'user' && !props.draft.confirmed && !props.replay ? props.userChibi : typeof actor.chibi === 'string' ? actor.chibi : undefined,
        x: clamp(number(actor.x, 50), 6, 94), y: clamp(number(actor.y, 86), 25, 98), scale: clamp(number(actor.scale, 1), .55, 1.7),
    }));
    for (const actor of defaults) if (!actors.some(existing => existing.id === actor.id)) actors.push(actor);
    return { actors, background: BACKGROUNDS.some(item => item.id === raw?.background) ? raw!.background! : 'lounge', panX: clamp(number(raw?.panX, 0), -24, 24), panY: clamp(number(raw?.panY, 0), -24, 24), zoom: clamp(number(raw?.zoom, 1), 1, 1.8), date: typeof raw?.date === 'string' ? raw.date : undefined };
}

function PhotoStudio(props: SARFamiliarityEffectsProps) {
    const { draft, onDraftChange, characters, onEditUserChibi, replay } = props;
    const [selected, setSelected] = useState('user'), [adding, setAdding] = useState(false), [flash, setFlash] = useState(false), [back, setBack] = useState(false);
    const stage = useRef<HTMLDivElement>(null), latest = useRef(props), drag = useRef<{ id: string; x: number; y: number; startX: number; startY: number; width: number; height: number } | null>(null);
    latest.current = props;
    const photo = readPhoto(props), confirmed = replay || draft.confirmed === true, current = photo.actors.find(actor => actor.id === selected);
    const backdrop = BACKGROUNDS.find(item => item.id === photo.background)!;
    const available = characters.filter(actor => actor.chibi && !photo.actors.some(existing => existing.id === `char:${actor.id}`));
    const update = (change: (value: PhotoDraft) => PhotoDraft) => {
        const currentProps = latest.current;
        const next = { ...currentProps.draft, confirmed: false, photo: change(readPhoto(currentProps)) };
        latest.current = { ...currentProps, draft: next };
        currentProps.onDraftChange(next);
    };
    const moveActor = (id: string, patch: Partial<PhotoActor>) => update(value => ({ ...value, actors: value.actors.map(actor => actor.id === id ? { ...actor, ...patch } : actor) }));
    const pointerDown = (event: React.PointerEvent, id: string) => {
        if (confirmed || !stage.current) return;
        event.preventDefault(); event.stopPropagation(); setSelected(id);
        const bounds = stage.current.getBoundingClientRect(), actor = photo.actors.find(item => item.id === id);
        drag.current = { id, x: id === 'background' ? photo.panX : actor!.x, y: id === 'background' ? photo.panY : actor!.y, startX: event.clientX, startY: event.clientY, width: bounds.width, height: bounds.height };
        event.currentTarget.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: React.PointerEvent) => {
        const start = drag.current; if (!start) return;
        const x = start.x + (event.clientX - start.startX) / start.width * 100, y = start.y + (event.clientY - start.startY) / start.height * 100;
        if (start.id === 'background') update(value => ({ ...value, panX: clamp(x, -24, 24), panY: clamp(y, -24, 24) }));
        else moveActor(start.id, { x: clamp(x, 6, 94), y: clamp(y, 25, 98) });
    };
    const confirm = () => {
        const date = new Date().toLocaleDateString('zh-CN'), value = readPhoto(latest.current);
        const friends = value.actors.some(actor => actor.id.startsWith('char:'));
        onDraftChange({ ...latest.current.draft, date, confirmed: true, photo: { ...value, date }, caption: `Caian 笑得非常明显。\nAiven 看着镜头，表情和平时没有太大区别。\n${props.userName}也在照片里。${friends ? '\n似乎朋友们也都在！' : ''}\n「没有得到答案。不过是一次很好的会议！」` });
        setFlash(true);
    };
    useEffect(() => { if (!flash) return; const timer = window.setTimeout(() => setFlash(false), 500); return () => clearTimeout(timer); }, [flash]);
    return <div className={`srf-fx-photo ${confirmed ? 'is-confirmed' : ''}`}>
        <div className={`srf-fx-polaroid sar-artifact-photo ${back ? 'is-back' : ''}`}><span className="sar-photo-corner is-left" aria-hidden="true"/><span className="sar-photo-corner is-right" aria-hidden="true"/>
            <div className={`srf-fx-photo-stage ${flash ? 'is-flashing' : ''} ${back ? 'show-back' : ''}`} ref={stage} aria-label="合照构图，横向为 X，纵向为 Y">
                <div className={`srf-fx-photo-background ${selected === 'background' ? 'is-selected' : ''}`} style={{ cursor: confirmed ? 'default' : 'grab' }} onPointerDown={event => pointerDown(event, 'background')} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
                    <img src={roomArt} alt="SAR 活动室合照背景" draggable={false} style={{ objectPosition: backdrop.position, transform: `translate(${photo.panX}%,${photo.panY}%) scale(${photo.zoom})` }} />
                </div>
                {photo.actors.map(actor => <button key={actor.id} type="button" className={`srf-fx-photo-actor ${selected === actor.id && !confirmed ? 'is-selected' : ''}`} data-actor={actor.id} aria-label={`调整${actor.name}的位置`} disabled={confirmed}
                    style={{ left: `${actor.x}%`, top: `${actor.y}%`, width: `${25 * actor.scale}%`, zIndex: Math.round(actor.y) + (selected === actor.id ? 2 : 0) }}
                    onClick={() => setSelected(actor.id)} onPointerDown={event => pointerDown(event, actor.id)} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
                    onKeyDown={event => { if (confirmed || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); const step = event.shiftKey ? 5 : 1; moveActor(actor.id, { x: clamp(actor.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), 6, 94), y: clamp(actor.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0), 25, 98) }); }}>
                    <Person actor={actor} />
                </button>)}
                <span className="srf-fx-viewfinder" aria-hidden="true" />
                {back && <div className="srf-fx-photo-back"><SARArtifactSeal/><small>写在照片背面</small><p>没有得到答案。<br />不过是一次很好的会议！</p><span>Caian</span>{photo.actors.some(actor => actor.id.startsWith('char:')) && <em>似乎朋友们也都在！</em>}</div>}
            </div>
            <div className="srf-fx-photo-caption"><span>第一次 SAR 会议</span><time>{photo.date || dateLabel(draft)}</time></div>
        </div>
        {confirmed ? <div className="srf-fx-photo-saved"><p>「没有得到答案。不过是一次很好的会议！」</p><button type="button" onClick={() => setBack(value => !value)}>{back ? '看看照片' : '看看背面'}</button>{!replay && <button type="button" onClick={() => { setBack(false); onDraftChange({ ...draft, confirmed: false }); }}><ArrowCounterClockwise size={15} />重新构图</button>}</div> : <div className="srf-fx-photo-tools">
            <details className="srf-fx-photo-controls" open={props.inScene ? undefined : true}><summary>调整构图</summary><div className="srf-fx-photo-tabs" role="group" aria-label="合照背景">{BACKGROUNDS.map(item => <button key={item.id} type="button" aria-pressed={photo.background === item.id} onClick={() => { setSelected('background'); update(value => ({ ...value, background: item.id, panX: 0, panY: 0 })); }}>{item.label}</button>)}</div>
            <div className="srf-fx-photo-adjust"><label><span>调整</span><select aria-label="选择要调整的人物或背景" value={selected} onChange={event => setSelected(event.target.value)}><option value="background">背景</option>{photo.actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select></label><label><span>大小</span><input type="range" aria-label={selected === 'background' ? '背景大小' : '人物大小'} min={selected === 'background' ? 1 : .55} max={selected === 'background' ? 1.8 : 1.7} step=".05" value={selected === 'background' ? photo.zoom : current?.scale || 1} onChange={event => selected === 'background' ? update(value => ({ ...value, zoom: Number(event.target.value) })) : moveActor(selected, { scale: Number(event.target.value) })} /></label>
                {selected.startsWith('char:') && <button type="button" aria-label="移出合照" onClick={() => { update(value => ({ ...value, actors: value.actors.filter(actor => actor.id !== selected) })); setSelected('user'); }}><Trash size={17} /></button>}
            </div>
            <p className="srf-fx-hint">拖动人物或背景调整位置，选中人物后也可以用方向键微调。</p>
            </details><div className="srf-fx-photo-actions"><button type="button" disabled={!available.length || photo.actors.length >= 10} aria-expanded={adding} onClick={() => setAdding(value => !value)}><Plus size={15} />朋友入镜</button>{onEditUserChibi && !replay && <button type="button" onClick={onEditUserChibi}><User size={15} />我的形象</button>}<button type="button" className="srf-fx-primary" onClick={confirm}><Camera size={17} />拍好了</button></div>
            {adding && <div className="srf-fx-photo-friends" aria-label="选择入镜的朋友">{available.map(actor => <button type="button" key={actor.id} onClick={() => { const id = `char:${actor.id}`; update(value => ({ ...value, actors: [...value.actors, { id, name: actor.name, chibi: actor.chibi, x: 20 + (value.actors.length % 5) * 14, y: 64, scale: .85 }] })); setSelected(id); setAdding(false); }}><TokenImg value={actor.chibi} alt="" /><span>{actor.name}</span></button>)}</div>}
        </div>}
    </div>;
}

function IdentityCard(props: SARFamiliarityEffectsProps) {
    const membership = props.effect.kind === 'membership-card';
    const member = props.draft.membership as { name?: string; chibi?: string } | undefined;
    const name = membership ? member?.name || props.userName : 'Caian';
    return <div className="srf-fx-id-wrap sar-artifact-id-stage"><article className={`srf-fx-id sar-artifact-identity ${membership ? 'is-member' : 'is-admin'}`}>
        <div className="sar-id-security" aria-hidden="true"/><header><div><strong>SAR</strong><span>彼方活动室</span></div><small>{membership ? 'MEMBER CARD' : 'ADMINISTRATOR'}</small></header>
        <div className="srf-fx-id-main sar-id-main"><div className="srf-fx-id-portrait">{membership ? <Person actor={{ name, chibi: (props.replay || props.draft.confirmed) && member ? member.chibi : props.userChibi }}/> : <SARPortrait who="caian" expression="normal"/>}<span className="sar-id-photo-label">{membership ? 'FIRST VISITOR' : 'CAIAN'}</span></div>
            <div className="sar-id-person"><small>{membership ? '成员姓名 / NAME' : '管理员 / NAME'}</small><strong>{name}</strong><span className="sar-id-number">No. <b>{membership ? '0001' : '0000'}</b></span><p>{membership ? '正式上任后的第一位访客' : '彼方兼职管理员'}</p></div>
        </div>
        <div className="sar-id-signature"><span>记录人 <b>Caian</b></span><SARArtifactSeal/><small>{membership ? 'WELCOME TO SAR' : 'OFFICIAL RECORD'}</small></div>
        <footer><span>SAR / {membership ? 'MEMBERSHIP' : 'STAFF'}</span><span>{dateLabel(props.draft)}</span></footer>
    </article><p className="srf-fx-artifact-note">{membership ? '他为第一位访客，认真留了一个编号。' : '照片是系统拍的。本人比这个精神多了。'}</p>
        {membership && !props.replay && <div className="srf-fx-id-actions">{props.onEditUserChibi && <button type="button" onClick={props.onEditUserChibi}><User size={16}/>调整我的形象</button>}<button type="button" className="srf-fx-primary" onClick={() => props.onDraftChange({ ...props.draft, date: new Date().toLocaleDateString('zh-CN'), confirmed: true, membership: { name: props.userName, chibi: props.userChibi || '' } })}>{props.draft.confirmed ? <><Check size={16}/>形象已确认</> : '就用这个形象'}</button></div>}
    </div>;
}

function MeetingRecord(props: SARFamiliarityEffectsProps) {
    return <div className="sar-document-stage"><article className="srf-fx-meeting sar-artifact-document"><i className="sar-document-clip" aria-hidden="true"/>
        <header><span><SARArtifactSeal/><small>SAR ACTIVITY SPACE<br/>会议档案 / MEETING RECORD</small></span><strong>001</strong></header>
        <div className="sar-document-title"><small>MINUTES OF THE FIRST MEETING</small><h3>第一次正式讨论会</h3><span>{dateLabel(props.draft)}</span></div>
        <dl><dt><i>01</i>议题</dt><dd className="sar-document-topic">人工人格的沉默是否能够<br className="sar-document-break"/>被视为一种自主选择</dd><dt><i>02</i>参与者</dt><dd>Caian · Aiven<span>（列席）</span> · {props.userName}</dd><dt><i>03</i>结论</dt><dd className="srf-fx-meeting-conclusion">{String(props.flags.meetingConclusion || '未得出结论')}</dd></dl>
        <div className="sar-document-postscript"><small>记录人备注</small><p>讨论仍然有意义。</p><span>Caian</span></div>
        <footer><span>SAR / MEETING LOG 001</span><span>01 — 01</span></footer>
    </article></div>;
}

function MemoryCard(props: SARFamiliarityEffectsProps) {
    return <div className="srf-fx-memory-wrap sar-memory-stage"><SARMemoryObject name={props.npc === 'aiven' ? 'Aiven' : props.userName}/><h3>{copy(props.effect.title, props)}</h3>{props.effect.text && <p className="srf-fx-memory-description">{copy(props.effect.text, props)}</p>}</div>;
}

function Chimera({ onReady }: { onReady?: () => void }) {
    const host = useRef<HTMLDivElement>(null), [failed, setFailed] = useState(false), [ready, setReady] = useState(false);
    useEffect(() => {
        let disposed = false; let engine: { dispose: () => void } | undefined;
        void Promise.all([import('./dinosaur/renderer'), import('../../utils/vrWorld/fishingMarket'), import('../../utils/vrWorld/dinosaurCatalog'), import('../../utils/vrWorld/dinosaurGarden')]).then(async ([render, market, catalog, garden]) => {
            if (disposed || !host.current) return;
            const id = 'familiarity-chimera-preview', now = Date.now();
            const base = { ...market.createFishingMarketState(1), inventory: [{ id, speciesId: 'aiven-chimera', ownerId: 'user', ownerName: '', caughtAt: now, weather: 'clear' as const, weatherLabel: '', weatherSource: 'simulated' as const, sizeCm: 12, quality: 1 as const, origin: { kind: 'gift' as const, actorId: 'sar-evan', actorName: '艾文', at: now } }], dinosaurGarden: { version: 2 as const, gridVersion: 1 as const, activeMapId: 'grassland', maps: catalog.createGardenMaps(), toys: {}, events: [], visitsEnabled: false, revision: 0 } };
            const state = garden.syncGardenToys(base), renderer = render.createGardenRenderer(host.current, { play: () => {}, selectProp: () => {}, select: () => {}, place: () => {}, ready: () => { if (!disposed) { setReady(true); onReady?.(); } }, error: () => { if (!disposed) setFailed(true); } });
            engine = renderer;
            state.dinosaurGarden!.toys[id].pose = { x: 1.6, z: 1.45, rotation: 0 };
            state.dinosaurGarden!.toys[id].mapId = 'grassland';
            await renderer.sync(state, id, 'portrait', catalog.defaultDinoPaint('aiven-chimera'));
            if (disposed) renderer.dispose();
        }).catch(() => { if (!disposed) setFailed(true); });
        return () => { disposed = true; engine?.dispose(); };
    }, []);
    return <div className="srf-fx-chimera-model" data-model-ready={ready}><div ref={host} className="srf-fx-chimera-view" />{(!ready || failed) && <div className="srf-fx-chimera-fallback"><DinoIcon species="aiven-chimera" color="#b69bbb" /><small>{failed ? '模型暂时未加载' : '有什么被钓上来了……'}</small></div>}<span className="srf-fx-chimera-question">？？？</span></div>;
}

function ScatteredProps({ items }: { items: string[] }) {
    return <div className="srf-fx-loot" aria-label="刚刚钓上来的东西">{items.map((item, i) => <div className="srf-fx-loot-item" key={`${item}:${i}`} style={{ '--i': i, '--tilt': `${[-6, 5, -2, 7, -4, 3, -5][i % 7]}deg` } as React.CSSProperties}>
        <span className="srf-fx-loot-art">{/鱼/.test(item) ? <FishArt speciesId="cloud-carp" size={74} /> : /恐龙/.test(item) ? <DinoIcon species="triceratops" color="#b5a0be" /> : /券/.test(item) ? <Ticket size={49} weight="duotone" /> : /胸牌/.test(item) ? <IdentificationCard size={47} weight="duotone" /> : /存档卡/.test(item) ? <FloppyDisk size={46} weight="duotone" /> : /雨靴/.test(item) ? <svg viewBox="0 0 70 65" role="img" aria-label="雨靴"><path d="M18 5h30l-3 32 15 9c6 4 5 14-1 14H12c-4-2-4-7-1-12l8-12z" fill="#bba789" stroke="#756552" strokeWidth="2" /><path d="M11 54h48M19 10h27" stroke="#f2e6cd" strokeWidth="4" /></svg> : <Cpu size={47} weight="duotone" />}</span><small>{item}</small>
    </div>)}</div>;
}

function Celebration(props: SARFamiliarityEffectsProps) {
    const [cycle, setCycle] = useState(0), coupons = props.effect.kind === 'coupon-rain';
    if (!coupons && props.inScene) return createPortal(<div className="srf-global-confetti" aria-hidden="true">{Array.from({ length: 56 }, (_, i) => <i key={i} style={{ '--x': ((i * 37 + 11) % 100) + '%', '--delay': ((i % 9) * .09) + 's', '--drift': ((i % 2 ? 1 : -1) * (24 + i % 80)) + 'px', '--turn': (180 + i * 43) + 'deg', '--color': ['#d4b46e', '#82ada1', '#c792a0', '#87a8c2', '#eee0ac'][i % 5] } as React.CSSProperties}/> )}</div>, document.body);
    return <div className={`srf-fx-celebration ${coupons ? 'is-coupons' : ''}`}><div className="srf-fx-particles" key={cycle} aria-hidden="true">{Array.from({ length: coupons ? props.effect.items?.length || 3 : 28 }, (_, i) => <i key={i} style={{ '--x': `${((i * 37 + 11) % 96) + 2}%`, '--delay': `${(i % 7) * .085}s`, '--turn': `${i * 43}deg`, '--color': ['#cfb178', '#c6a6a0', '#a6b8c4', '#e1ccb0'][i % 4] } as React.CSSProperties}>{coupons && <><Ticket size={24} /><span>9 折券</span></>}</i>)}</div><div className="srf-fx-celebration-focus">{coupons ? <Ticket size={63} weight="duotone" /> : <Sparkle size={63} weight="duotone" />}<h3>{copy(props.effect.title, props)}</h3>{props.effect.text && <p>{copy(props.effect.text, props)}</p>}<button type="button" onClick={() => setCycle(value => value + 1)}>再看一次</button></div></div>;
}

export function SARFamiliarityEffects(props: SARFamiliarityEffectsProps) {
    const { effect, draft, onDraftChange } = props;
    const [inspecting, setInspecting] = useState(false);
    const inspectable = !!props.inScene && !['confetti', 'coupon-rain', 'notice'].includes(effect.kind);
    const title = copy(effect.title, props) || '物品详情';
    const confirmed = draft.confirmed === true;
    const confirm = () => onDraftChange({ ...draft, confirmed: true, date: dateLabel(draft) });
    const ownConfirmation = ['photo-studio', 'membership-card', 'mystery-button'].includes(effect.kind);
    useEffect(() => { if (props.replay && effect.interactive && !draft.confirmed) onDraftChange({ ...draft, confirmed: true }); }, [props.replay, effect.interactive, draft.confirmed]);
    return <section className={`srf-fx srf-fx-${effect.kind} ${inspectable ? 'is-inspectable' : ''}`} aria-label={copy(effect.title, props) || '特别演出'} onClick={event => {
        if (!inspectable || !(event.target instanceof Element) || event.target.closest('button,input,select,summary,a,canvas')) return;
        if (effect.kind === 'photo-studio' && !confirmed && !props.replay) return;
        if (event.target.closest('.sar-artifact-identity,.sar-artifact-document,.sar-memory-stage,.srf-fx-discount-stage,.sar-artifact-photo,.srf-fx-loot-item')) setInspecting(true);
    }}>
        {inspectable && <button type="button" className="srf-object-zoom" aria-label="放大查看物品" onClick={() => setInspecting(true)}><MagnifyingGlassPlus size={16}/>放大查看</button>}
        {inspecting && <SARObjectInspector title={title} onClose={() => setInspecting(false)}><SARFamiliarityEffects {...props} inScene={false} replay draft={{ ...draft, confirmed: true }} onDraftChange={() => {}} onEditUserChibi={undefined}/></SARObjectInspector>}
        {effect.kind === 'photo-studio' ? <PhotoStudio {...props} />
            : effect.kind === 'admin-card' || effect.kind === 'membership-card' ? <IdentityCard {...props} />
            : effect.kind === 'meeting-record' ? <MeetingRecord {...props} />
            : effect.kind === 'memory-card' ? <MemoryCard {...props} />
            : effect.kind === 'confetti' || effect.kind === 'coupon-rain' ? <Celebration {...props} />
            : effect.kind === 'chimera' ? <div className="srf-fx-chimera-wrap"><Chimera /><h3>{copy(effect.title, props)}</h3><p>{copy(effect.text, props)}</p><small>拖动看看它的另一面</small></div>
            : effect.kind === 'loot-burst' ? <div className="srf-fx-loot-wrap"><small>FROM THE WATER</small><h3>{copy(effect.title, props)}</h3><div className="srf-fx-loot-scene"><div className="srf-fx-loot-npc is-caian"><SARNpcChibi who="caian" /><small>凯恩</small></div><ScatteredProps items={(effect.items || []).map(item => copy(item, props))} /><div className="srf-fx-loot-npc is-aiven"><SARNpcChibi who="aiven" /><small>艾文</small></div></div></div>
            : effect.kind === 'discount' ? <div className="srf-fx-discount-stage"><div className="srf-fx-discount-ticket"><small>SAR / MODULE SHOP</small><strong>{discountLabel(effect)}<em>折</em></strong><p>{copy(effect.title, props)}</p><span>{copy(effect.text, props) || '模块商店限时优惠'}</span><i /><i /></div></div>
            : effect.kind === 'mystery-button' ? <div className="srf-fx-mystery"><small>SAR / UNKNOWN DEVICE</small><button type="button" className={confirmed ? 'is-pressed' : ''} aria-label="按下神秘按钮" onClick={() => onDraftChange({ ...draft, confirmed: true, mysteryPressed: true })}>{confirmed ? <Check size={48} /> : <Question size={48} weight="bold" />}</button><h3>{copy(effect.title, props) || '一个意义不明的按钮'}</h3><p>{confirmed ? '咔哒。' : copy(effect.text, props) || '似乎可以按下去。'}</p></div>
            : <div className="srf-fx-notice-panel"><Sparkle size={33} weight="duotone" /><h3>{copy(effect.title, props)}</h3>{effect.text && <p>{copy(effect.text, props)}</p>}{!!effect.items?.length && <ul>{effect.items.map((item, i) => <li key={i}>{copy(item, props)}</li>)}</ul>}</div>}
        {effect.interactive && !ownConfirmation && !props.replay && <button type="button" className="srf-fx-primary srf-fx-confirm" onClick={confirm}>{confirmed ? <><Check size={16} />看清了</> : effect.kind === 'chimera' ? '仔细看过了' : '继续看看'}</button>}
    </section>;
}
