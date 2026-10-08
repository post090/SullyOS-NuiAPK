// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import catalog from '../public/room3d/catalog.json';
import {createHome} from '../apps/room3d/model.js';
import {createPetLife} from '../apps/room3d/petLife.js';
import {mountPetSystem} from '../apps/room3d/petSystem.js';
vi.mock('../apps/room3d/petPortraits.js',()=>({createPetPortraits:()=>({get:()=>'',dispose:()=>{}})}));
const cleanup:Array<()=>void>=[];
afterEach(()=>{cleanup.splice(0).forEach(f=>f());});
function setup(){const home=createHome(catalog);home.rooms[0].items=[];const life=createPetLife({home:()=>home,catalog});return {home,life};}
it('removes only the chosen pet, persists it, stops its action and restores all its attributes without rewarding it',()=>{
 const {home,life}=setup(),pet=life.adopt('pet_cat','团子',['shy']),other=life.adopt('pet_dog','毛球');
 pet.color='#123456';pet.relations.user=42;pet.needs.food=20;pet.memory.lastFedBy='user';
 life.interact(pet.id,'feed');const before=structuredClone(pet),events=structuredClone(life.data.events);
 life.remove(pet.id);expect(home.petLife.pets.map((p:any)=>p.id)).toEqual([other.id]);expect(life.runtime.has(pet.id)).toBe(false);
 expect(normalizeSaved(home).pets.map((p:any)=>p.id)).toEqual([other.id]);expect(life.data.events).toEqual(events);
 expect(life.undoRemove()).toEqual(before);expect(life.runtime.has(pet.id)).toBe(false);expect(life.lastRemoved).toBeUndefined();
 expect(life.data.pets.map((p:any)=>p.id)).toEqual([pet.id,other.id]);
 expect(()=>life.remove('missing')).toThrow();expect(()=>life.undoRemove()).toThrow();
});
function normalizeSaved(home:any){const copy=structuredClone(home);return createPetLife({home:()=>copy,catalog}).data;}
it('does not lose the undo record when the home is full, and restores successive removals in order',()=>{
 const {life}=setup();for(let i=0;i<7;i++)life.adopt('pet_cat',`猫${i}`);
 const first=life.data.pets[0].id;life.remove(first);const newcomer=life.adopt('pet_dog','新伙伴');
 expect(()=>life.undoRemove()).toThrow('先腾出一个位置');expect(life.lastRemoved.id).toBe(first);
 life.remove(newcomer.id);expect(life.undoRemove().id).toBe(newcomer.id);
 life.remove(newcomer.id);life.remove(life.data.pets[0].id);life.undoRemove();
 expect(life.data.pets).toHaveLength(6);expect(life.lastRemoved.id).toBe(newcomer.id);
 life.restore(life.data);expect(life.lastRemoved).toBeUndefined();
});
it('requires confirmation, supports cancellation, releases an active contact and can undo after closing the panel',()=>{
 const {home}=setup(),host=document.createElement('div');document.body.append(host);
 const stop=vi.fn(),reset=vi.fn(),group=new THREE.Group();
 const system=mountPetSystem({host,scene:new THREE.Scene(),home:()=>home,catalog,templates:new Map(),actors:()=>[],contactBridge:()=>({group,visitor:{rig:{bones:{R_hand:new THREE.Bone(),L_hand:new THREE.Bone(),chest:new THREE.Bone()}}},stop,reset,valid:()=>true,walking:()=>true}),changed:vi.fn(),invalidate:vi.fn(),context:()=>({paused:false,edit:false,overview:false})});
 cleanup.push(()=>{system.dispose();host.remove();});
 const pet=system.life.adopt('pet_cat','<团子>');system.life.data.autonomy=false;system.open(pet.id);
 const click=(action:string)=>host.querySelector<HTMLButtonElement>(`[data-pet-action="${action}"]`)!.click();
 click('remove');expect(host.querySelector('[role="alertdialog"]')!.textContent).toContain('<团子>');expect(system.life.data.pets).toHaveLength(1);
 click('cancel-remove');expect(system.life.data.pets).toHaveLength(1);
 system.contact.start(pet.id,'carry');click('remove');click('confirm-remove');
 expect(system.contact.busy).toBe(false);expect(stop).toHaveBeenCalled();expect(reset).toHaveBeenCalled();expect(system.life.runtime.size).toBe(0);expect(system.life.data.pets).toHaveLength(0);
 click('close');system.open();click('undo-remove');expect(system.life.data.pets[0]).toMatchObject({id:pet.id,name:'<团子>',relations:{}});expect(host.querySelector('[data-pet-action="remove"]')).not.toBeNull();
});
