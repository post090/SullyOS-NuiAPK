import {afterEach,expect,it,vi} from 'vitest';
import catalog from '../public/room3d/catalog.json';
import {createHome} from '../apps/room3d/model.js';
import {createPetLife} from '../apps/room3d/petLife.js';
import {makeHomeRecord} from './homeRecords';
afterEach(()=>vi.unstubAllGlobals());
it('creates pets and conversation records without secure-context UUID support',()=>{
 const native=globalThis.crypto;
 vi.stubGlobal('crypto',{getRandomValues:native.getRandomValues.bind(native)});
 const home=createHome(catalog);home.rooms[0].items=[];
 const life=createPetLife({home:()=>home,catalog});
 const pet=life.adopt('pet_cat','猫');
 const input={kind:'message' as const,source:'user' as const,actor:'user' as const,text:'你好',roomId:home.activeRoomId,roomName:home.rooms[0].name};
 const a=makeHomeRecord(input),b=makeHomeRecord(input);
 expect(new Set([home.activeRoomId,pet.id,a.id,b.id]).size).toBe(4);
 expect(a).toMatchObject(input);expect(life.data.pets).toContain(pet);
});
