import * as T from 'three';
import {eatingHand} from './diningMotion.js';
export function createKitchenEffects(resident){
 const meal=new T.Group();meal.name='chibi-meal';meal.scale.setScalar(.7);meal.visible=false;resident.add(meal);const bowl=new T.Group(),spoon=new T.Group();bowl.name='meal-bowl';spoon.name='meal-spoon';meal.add(bowl,spoon);const resources=[];
 const material=color=>{const m=new T.MeshStandardMaterial({color,roughness:.8});resources.push(m);return m;},cream=material('#88b9aa'),rice=material('#fffdf0'),green=material('#75985c'),wood=material('#b77e52');
 const add=(r,g,m)=>{resources.push(g);const o=new T.Mesh(g,m);r.add(o);return o;};
 const profile=[[0,0],[.11,0],[.16,.055],[.17,.10],[.145,.10],[.12,.025],[0,.025]].map(p=>new T.Vector2(...p));add(bowl,new T.LatheGeometry(profile,20),cream);
 const food=add(bowl,new T.SphereGeometry(.135,16,8),rice);food.scale.y=.25;food.position.y=.083;for(const x of [-.055,.045]){const piece=add(bowl,new T.SphereGeometry(.032,8,6),green);piece.position.set(x,.119,.018);}
 const stem=add(spoon,new T.CylinderGeometry(.016,.016,.30,8),wood);stem.rotation.x=Math.PI/2;stem.position.z=.11;const tip=add(spoon,new T.SphereGeometry(.06,12,6),cream);tip.scale.set(.75,.27,1);tip.position.z=.27;
 let doors=[],openId=null;
 function clearDoors(){for(const d of doors)d.pivot.rotation.y=d.rest;doors=[];openId=null;}
 return {meal,
  get moving(){return doors.some(d=>Math.abs(d.pivot.rotation.y-d.target)>.001);},
  isOpen:id=>openId===id,
  toggle(obj){if(openId===obj.userData.itemId){for(const d of doors)d.target=d.rest;openId=null;return;}clearDoors();openId=obj.userData.itemId;obj.traverse(pivot=>{const role=pivot.userData.kitchenRole;if(role==='fridge-left'||role==='fridge-right')doors.push({pivot,rest:pivot.rotation.y,target:pivot.rotation.y+(role==='fridge-left'?-1:1)*1.48});});},
  updateDoors(dt,instant=false){let changed=false;for(const d of doors){const delta=d.target-d.pivot.rotation.y;if(Math.abs(delta)<.001){d.pivot.rotation.y=d.target;continue;}d.pivot.rotation.y+=Math.sign(delta)*Math.min(Math.abs(delta),instant?Infinity:dt*3.2);changed=true;}return changed;},
  updateMeal(activity,time,hand){meal.visible=activity?.kind==='eat';if(!meal.visible)return;bowl.position.fromArray(activity.meal);bowl.position.y-=.065;spoon.position.fromArray(hand?(hand.position??hand).map(v=>v/.7):eatingHand(activity.hands[1],time,1));if(hand?.rotation)spoon.quaternion.copy(hand.rotation);else spoon.rotation.set(-.12,Math.PI,0);},
  clear(){clearDoors();meal.visible=false;},
  inspect(){return {openId,moving:this.moving,angles:doors.map(d=>d.pivot.rotation.y),mealVisible:meal.visible};},
  dispose(){clearDoors();meal.removeFromParent();resources.forEach(r=>r.dispose());}
 };
}
