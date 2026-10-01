// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {SARFamiliarityDialog} from '../apps/vrWorld/SARFamiliarityDialog';
import {createFishingMarketState, saveFishingMarketState, type FishingMarketState} from './vrWorld/fishingMarket';
import {familiarityScenes} from './vrWorld/sarFamiliarity/catalog';
import {freshFamiliarity} from './vrWorld/sarFamiliarity/storageTypes';
import {keepDialogueGuest} from './vrWorld/sarDialogueStaging';

const {visit}=vi.hoisted(()=>({visit:vi.fn()}));
vi.mock('../context/OSContext',()=>({useOS:()=>({userProfile:{name:'小雨'},characters:[]})}));
vi.mock('../apps/vrWorld/SARFamiliarityEffects',()=>({SARFamiliarityEffects:()=>null}));
vi.mock('./vrWorld/participation',()=>({isSARActivityOccupant:()=>false}));
vi.mock('./vrWorld/sarFamiliarity/state',async importOriginal=>({...await importOriginal<typeof import('./vrWorld/sarFamiliarity/state')>(),visitFamiliarity:visit,deliverFamiliarityMessages:vi.fn(async()=>{})}));

let container:HTMLDivElement,root:Root;
beforeEach(()=>{
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();visit.mockReset();
    container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(()=>{act(()=>root.unmount());container.remove();});
const render=()=>root.render(React.createElement(SARFamiliarityDialog,{npc:'caian',onClose:()=>{},onEditUserChibi:()=>{}}));
const withCursor=(sceneId:string,nodeId:string,line:number):FishingMarketState=>{
    const state={...createFishingMarketState(17),sarFamiliarity:freshFamiliarity()};
    state.sarFamiliarity.npcs.caian.pending={runId:'test',sceneId,nodeId,line,revision:0,startedAt:1,flags:{},drafts:{},userName:'小雨',speaker:'aiven',cast:{caian:'normal',aiven:'normal'},guestPresent:false};
    return state;
};

it('does not flash an old guest while the interrupted conversation is being restarted',async()=>{
    const scene=familiarityScenes('caian').find(s=>Object.values(s.nodes).some(n=>n.lines.some(l=>l.speaker==='aiven')))!;
    const [nodeId,node]=Object.entries(scene.nodes).find(([,n])=>n.lines.some(l=>l.speaker==='aiven'))!;
    const old=withCursor(scene.id,nodeId,node.lines.findIndex(l=>l.speaker==='aiven'));
    let ready!:(state:FishingMarketState)=>void;visit.mockImplementation(()=>new Promise(resolve=>{ready=resolve;}));
    await act(async()=>render());
    // Commerce preparation can publish the old save before visitFamiliarity resets it.
    await act(async()=>{saveFishingMarketState(old);window.dispatchEvent(new Event('storage'));});
    expect(container.querySelector('.cast-aiven')).toBeNull();
    expect(container.querySelector('.srf-line')?.textContent).toBe('正在走进活动室…');
    await act(async()=>ready(withCursor(scene.id,scene.start,0)));
    expect(container.querySelector('.cast-aiven')).toBeNull();
    await act(async()=>saveFishingMarketState(old));
    expect(container.querySelector('.cast-aiven')).not.toBeNull();
});

it('does not bring a departed guest back just because the next narration remembers their voice',async()=>{
    const candidates=familiarityScenes('caian').flatMap(scene=>Object.entries(scene.nodes).flatMap(([nodeId,node])=>node.lines.map((line,index)=>({scene,nodeId,node,line,index}))));
    const pick=candidates.find(c=>c.line.speaker==='narrator'&&!c.node.effect&&!keepDialogueGuest(c.scene.nodes,c.nodeId,c.index,'caian',false))!;
    expect(pick).toBeDefined();visit.mockResolvedValue(withCursor(pick.scene.id,pick.nodeId,pick.index));
    await act(async()=>render());
    expect(container.querySelectorAll('.sar-dialogue-cast__actor')).toHaveLength(1);
    expect(container.querySelector('.cast-aiven')).toBeNull();
});
