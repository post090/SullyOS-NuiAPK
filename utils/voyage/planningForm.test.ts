// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHash, webcrypto } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import VoyagePlanning from '../../apps/VoyagePlanning';
import { VoyageCharacterSettings } from '../../apps/VoyageContextFields';
import { makeConnection, rememberConnection } from './planner';
import { DB } from '../db';
import type { TravelInvitation, TripDraft } from './letter';
import * as invitations from './invitations';

it('keeps notes with their recipient and sends exactly the preview only on submission', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('crypto', webcrypto);
    const settings = new Map<string, string>();
    vi.spyOn(DB, 'getAsset').mockImplementation(async key => settings.get(key) ?? null);
    vi.spyOn(DB, 'saveAsset').mockImplementation(async (key, text) => { settings.set(key, text); });
    const connection = makeConnection('https://planner.example.org', 'd'.repeat(43));
    const submissions: string[] = [];
    const fetcher = vi.fn(async (url: string, options: RequestInit) => {
        if (url.endsWith('/status')) return Response.json({ subscriptions: 1, chatReviewAvailable: true, characterReference: true });
        if (options.method === 'GET') return new Response(null, { status: 404 });
        const body = String(options.body);
        submissions.push(body);
        return Response.json({ ...JSON.parse(body), id: url.split('/').pop(), state: 'requested', draft: null, approvedDraft: null });
    });
    vi.stubGlobal('fetch', fetcher);
    const host = document.createElement('div');
    const root = createRoot(host);
    const one = { id: 'notes-recipient', systemPrompt: ' 第一位的原文\n保留换行。' };
    const two = { id: 'other-recipient', systemPrompt: '另一位的主提示词' };
    const library = [{ id:'book-a', title:'旅行背景', category:'历史', content:' 世界书原文 ', createdAt:1, updatedAt:1 }];
    const letter: TravelInvitation = { id:'letter-with-notes', charId:one.id, occasion:'gift', note:'私人邀请',sentAt:1,
        reply:{ at:2, decision:'accept', text:'去散步吧' } };
    const setting = (actor: typeof one) => React.createElement(VoyageCharacterSettings, { key: actor.id, actor, library });
    const button = (name: string) => Array.from(host.querySelectorAll('button')).find(el => el.textContent === name);
    async function render(view: React.ReactElement) {
        await act(async () => root.render(view));
        await vi.waitFor(() => expect(host.querySelector('select')).toBeTruthy());
    }
    async function editText(field: HTMLTextAreaElement, value: string) {
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value);
            field.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }
    const note = ' 途中可以休息。\n也可以去海边。 ';
    const preview = '【角色主提示词】\n' + one.systemPrompt + '\n\n【附加叮嘱】\n' + note + '\n\n【世界书 · 旅行背景】\n' + library[0].content;
    try {
        await render(setting(one));
        await editText(host.querySelector('textarea')!, note);
        await act(async () => host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
        expect(host.querySelector('pre')?.textContent).toBe(preview);
        await act(async () => button('保存此角色的选择')!.click());
        await vi.waitFor(() => expect(button('已保存')).toBeDefined());
        await render(setting(two));
        expect(host.querySelector('textarea')!.value).toBe('');
        expect(host.querySelector('pre')?.textContent).toBe('【角色主提示词】\n' + two.systemPrompt);
        expect(fetcher).not.toHaveBeenCalled();
        rememberConnection(connection);
        await render(React.createElement(VoyagePlanning, { letter, actor: one, worldbooks: library }));
        expect(host.querySelector('pre')?.textContent).toBe(preview);
        await act(async () => button('采用对方的回信')!.click());
        expect(submissions).toHaveLength(0);
        await act(async () => button('发给点点，在聊天中审核')!.click());
        await vi.waitFor(() => expect(submissions).toHaveLength(1));
        expect(JSON.parse(submissions[0])).toEqual({ brief: letter.reply!.text, referenceText: preview, reviewMode:'chat' });
        expect(host.textContent).toContain('已发送的角色资料');
    } finally {
        await act(async () => root.unmount());
        rememberConnection(null);
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    }
});

it('opens approved old drafts and shows the practical and on-site details of a new stop to the owner', () => {
    const actor = { id: 'reader', systemPrompt: '' };
    const draft: TripDraft = { version: 1, digest: 'a'.repeat(64), content: { destination: '海边',
        outline: '上午散步', weather: '临近核对', alternatives: '雨天可选展馆', sources: ['https://example.org/harbor'] } };
    const letter: TravelInvitation = { id:'readable', charId:actor.id, occasion:'gift', note:'', sentAt:1 };
    const render = (approvedPlan: TripDraft) => renderToStaticMarkup(React.createElement(VoyagePlanning, { actor, worldbooks:[],
        letter:{ ...letter, approvedPlan } }));
    expect(render(draft)).toContain('上午散步');
    expect(render(draft)).not.toContain('分站行程');
    const detailed = render({ ...draft, content:{ ...draft.content, itinerary:{ timeZone:'Asia/Shanghai', stops:[{
        day:1, startLocal:'11:20', durationMinutes:30, place:'港口', route:'从车站沿步道到港口', cost:'参观免费',
        weatherPlan:'强风改去展馆', placeNotes:'旧码头的泊位编号', scene:'若有船靠岸，可以听岸边的动静',
        choices:['寻找泊位编号','在长椅上休息'], sourceNumbers:[1],
    }] } } });
    for (const text of ['11:20', '从车站沿步道到港口', '强风改去展馆', '参观免费', '旧码头的泊位编号', '若有船靠岸', '在长椅上休息', 'https://example.org/harbor'])
        expect(detailed).toContain(text);
});

it('loads reference photos on opening a stop and retains the attribution and source on image failure', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement('div'), root = createRoot(host);
    const photo = { imageUrl:'https://upload.wikimedia.org/wikipedia/commons/1/12/Quay.jpg', sourceUrl:'https://example.org/works/quay',
        caption:'港区旧码头', credit:'港口档案馆', license:'CC BY 4.0', licenseUrl:'https://creativecommons.org/licenses/by/4.0/' };
    const base = { day:1, startLocal:'09:00', durationMinutes:20, place:'码头', route:'步行', cost:'免费',
        weatherPlan:'雨天走廊', placeNotes:'旧泊位', scene:'看标牌', choices:['散步','休息'], sourceNumbers:[1] };
    const approvedPlan: TripDraft = { version:2, digest:'b'.repeat(64), content:{ destination:'港口', outline:'散步',
        weather:'待查', alternatives:'展馆', sources:['https://example.org/harbor'], itinerary:{ timeZone:'Asia/Shanghai', stops:[
            { ...base, visuals:{photos:[photo]} }, { ...base, visuals:{photos:[],unavailableReason:'展馆没有发布可转载的照片'} },
        ] } } };
    try {
        await act(async () => root.render(React.createElement(VoyagePlanning, { actor:{ id:'photo-reader',systemPrompt:'' }, worldbooks:[],
            letter:{ id:'photo-trip', charId:'photo-reader', occasion:'gift',note:'', sentAt:1, approvedPlan } })));
        expect(host.querySelector('img')).toBeNull();
        const details = host.querySelectorAll('details');
        await act(async () => { for (const item of details) { item.open = true; item.dispatchEvent(new Event('toggle')); } });
        const img = host.querySelector('img')!;
        expect(img.src).toBe('https://commons.wikimedia.org/wiki/Special:Redirect/file/Quay.jpg?width=960');
        expect(img.alt).toBe(photo.caption);
        await act(async () => img.dispatchEvent(new Event('error')));
        expect(host.textContent).toContain('图片暂时无法加载');
        expect(host.textContent).toContain(photo.credit);
        expect(host.textContent).toContain('展馆没有发布可转载的照片');
        expect(Array.from(host.querySelectorAll('figcaption a'), a => a.getAttribute('href'))).toEqual([photo.licenseUrl, photo.sourceUrl, photo.imageUrl]);
    } finally {
        await act(async () => root.unmount());
        vi.unstubAllGlobals();
    }
});

it('refreshes an incomplete cached approval on open while a complete old text approval stays offline', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('crypto', webcrypto);
    const host = document.createElement('div'), root = createRoot(host);
    const content = { destination:'海港', outline:'步行', weather:'待查', alternatives:'休息', sources:['https://example.org/quay'] };
    const signed = (text: typeof content) => ({ version:1, digest:createHash('sha256').update(JSON.stringify(text)).digest('hex'), content:text });
    const full = signed(content);
    const actor = { id:'older-reader',systemPrompt:'' };
    const letter: TravelInvitation = { id:'older-snapshot', charId:actor.id, occasion:'gift',note:'',sentAt:1, reply:{at:2,decision:'accept',text:'好'} };
    const save = vi.spyOn(invitations, 'saveApprovedPlan').mockResolvedValue({ ...letter, approvedPlan:full });
    const fetcher = vi.fn(async (url:string) => url.endsWith('/status') ? Response.json({subscriptions:1}) :
        Response.json({ id:url.split('/').pop(), brief:'半日', state:'approved', draft:full, approvedDraft:full }));
    vi.stubGlobal('fetch', fetcher);
    rememberConnection(makeConnection('https://planner.example.org', 's'.repeat(43)));
    async function show(approvedPlan:TripDraft) {
        await act(async () => root.render(React.createElement(VoyagePlanning, { actor, worldbooks:[], letter:{...letter,approvedPlan} })));
    }
    try {
        await show(full);
        expect(fetcher).not.toHaveBeenCalled();
        await show({ ...full, content:{ ...content, outline:'旧版保留的文字' } });
        await vi.waitFor(() => expect(save).toHaveBeenCalledWith(letter.id,actor.id,full));
        expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
        await act(async () => root.unmount());
        rememberConnection(null);
        vi.restoreAllMocks(); vi.unstubAllGlobals();
    }
});
