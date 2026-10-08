import {describe,it,expect} from 'vitest';
import {chooseCompanionAction,parseCompanionPolicy,quietCompanion,speechPages} from './homeCompanion';
const available={ready:true,canMove:true,distance:4,userMoved:true,canSit:false};
const policy={approach:1,follow:1,sit:1,warmth:1};
describe('local companionship',()=>{
 it('never interrupts a busy actor or player controlled actor',()=>{expect(chooseCompanionAction({...available,ready:false,reactionId:'touch'},policy,{nextAt:0},1,0)).toBeNull();});
 it('honors cooldowns and does not repeatedly react to one interaction',()=>{expect(chooseCompanionAction({...available,reactionId:'touch'},policy,{nextAt:20,reactionAt:0},1,0)).toBeNull();expect(chooseCompanionAction({...available,canMove:false,reactionId:'touch'},policy,{nextAt:0,reactionId:'touch'},30,0)).toBeNull();});
 it('allows an idle reaction after interaction without overriding a movement hold',()=>{expect(chooseCompanionAction({...available,canMove:false,reactionId:'touch'},policy,{nextAt:0},1,0)).toBe('react');expect(chooseCompanionAction({...available,canMove:false},policy,{nextAt:0},1,0)).toBeNull();});
 it('only follows when the user moved and policy permits it',()=>{expect(chooseCompanionAction(available,policy,{nextAt:0},1,.1)).toBe('follow');expect(chooseCompanionAction(available,{...policy,follow:0,approach:0},{nextAt:0},1,.1)).toBeNull();expect(chooseCompanionAction({...available,userMoved:false},policy,{nextAt:0},1,.1)).toBe('approach');});
 it('uses nearby available seats and otherwise does not invent them',()=>{expect(chooseCompanionAction({...available,distance:2,canSit:true},policy,{nextAt:0},1,.3)).toBe('sit');expect(chooseCompanionAction({...available,distance:2},policy,{nextAt:0},1,.3)).toBeNull();});
 it('has no following by default and clamps model tendencies',()=>{expect(quietCompanion.follow).toBe(0);expect(parseCompanionPolicy('{"approach":9,"follow":-1,"sit":0.4,"warmth":0}')).toEqual({approach:1,follow:0,sit:.4,warmth:0});expect(()=>parseCompanionPolicy('{"follow":true}')).toThrow();});
 it('keeps all spoken text including emoji through page boundaries',()=>{const text='你好🙂'.repeat(40);const pages=speechPages(text);expect(pages.join('')).toBe(text);expect(pages.every(p=>Array.from(p).length<=108)).toBe(true);});
});

it('reacts to fresh interaction even during ordinary wandering cooldown',()=>{expect(chooseCompanionAction({...available,reactionId:'new'},policy,{nextAt:45000},100,0)).toBe('react');});

it('keeps seated idle actors seated while allowing nonverbal activity',()=>{expect(chooseCompanionAction({...available,canMove:false,canIdle:true},policy,{nextAt:0},100,.8)).toBe('phone');});
it('has an idle activity after arriving instead of only repeating a turn toward the user',()=>{expect(chooseCompanionAction({...available,distance:1,canIdle:true},policy,{nextAt:0},100,.8)).toBe('phone');expect(chooseCompanionAction({...available,distance:1,canIdle:true},policy,{nextAt:0},100,.4)).toBe('wander');});
it('does not let idle activity bypass cooldown or an occupied actor',()=>{expect(chooseCompanionAction({...available,canIdle:true},policy,{nextAt:200},100,.8)).toBeNull();expect(chooseCompanionAction({...available,ready:false,canIdle:true},policy,{nextAt:0},100,.8)).toBeNull();});

it('gets up after a seated rest but never interrupts conversation',()=>{expect(chooseCompanionAction({...available,canMove:false,canIdle:true,canRise:true},policy,{nextAt:0},100,.8)).toBe('stand');expect(chooseCompanionAction({...available,ready:false,canRise:true},policy,{nextAt:0},100,.8)).toBeNull();});
it('selects furniture and avoids repeating phone or furniture on consecutive rounds',()=>{expect(chooseCompanionAction({...available,distance:1,canIdle:true,canUseFurniture:true},policy,{nextAt:0},100,.4)).toBe('furniture');expect(chooseCompanionAction({...available,distance:1,canIdle:true,canUseFurniture:true},policy,{nextAt:0,lastAction:'furniture'},100,.4)).toBe('wander');expect(chooseCompanionAction({...available,distance:1,canIdle:true},policy,{nextAt:0,lastAction:'phone'},100,.8)).toBe('wander');});

it('keeps full sentence endings and only breaks an oversized sentence at clauses',()=>{const a='这是一句比较长的完整话。'.repeat(4),b='最后一句还没有被丢掉。';expect(speechPages(a+b).join('')).toBe(a+b);expect(speechPages(a+b).every(p=>/[。！？]$/.test(p))).toBe(true);const one='甲'.repeat(60)+'。';expect(speechPages(one)).toEqual([one]);});

it('chooses local pet companionship only when available and does not repeat it consecutively',()=>{const s={...available,canInteractPet:true,canIdle:true,distance:1};expect(chooseCompanionAction(s,policy,{nextAt:0},100,.2)).toBe('pet');expect(chooseCompanionAction({...s,canInteractPet:false},policy,{nextAt:0},100,.2)).not.toBe('pet');expect(chooseCompanionAction(s,policy,{nextAt:0,lastAction:'pet'},100,.2)).not.toBe('pet');expect(chooseCompanionAction({...s,canMove:false},policy,{nextAt:0},100,.2)).not.toBe('pet');});
