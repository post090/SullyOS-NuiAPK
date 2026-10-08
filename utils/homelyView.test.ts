import {expect,it} from 'vitest';
import {homelyFrame,homeBubblePosition} from '../apps/room3d/homelyView';
import {buildHomeScenePrompt} from './homeConversation';
it.each([[390,844],[320,568],[1024,768],[1440,900]])('keeps the resident in the uncovered area at %s × %s', (w,h)=>{
 const open=homelyFrame(w,h,true),closed=homelyFrame(w,h,false);
 expect(open.viewWidth/open.viewHeight).toBeCloseTo(w/h);
 expect(open.viewHeight).toBe(closed.viewHeight);
 expect(closed.offsetX).toBe(0);
 expect(closed.offsetY).toBe(0);
 const residentX=.5-open.offsetX/open.viewWidth;
 if(w<700&&h>550)expect(residentX).toBe(.5);
 else{expect(residentX).toBeGreaterThan(.2);expect(residentX).toBeLessThan(.5);}
});
it.each([[320,568],[390,844]])('keeps the standing face above the portrait chat sheet at %s × %s',(w,h)=>{
 const frame=homelyFrame(w,h,true);
 const faceY=.5-(2.1-(1.7+frame.offsetY))/frame.viewHeight;
 expect(faceY).toBeGreaterThan(.15);expect(faceY).toBeLessThan(.35);
 expect(homelyFrame(w,360,true).offsetY).toBe(0);
});
it('only the first-person home prompt identifies the viewer as the conversation partner',()=>{
 const scene={roomId:'r',roomName:'客厅',present:true,busy:false,activity:'坐着',actions:[]};
 expect(buildHomeScenePrompt({name:'小雨'} as any,{...scene,perspective:'first-person'})).toContain('镜头代表小雨的视线');
 expect(buildHomeScenePrompt({name:'小雨'} as any,scene)).not.toContain('第一人称');
});
it('keeps thought tails and speech tails outside the projected hair at different character sizes',()=>{
 for(const headTopY of [105,180,260]){
  const anchor={x:180,y:headTopY+90,width:390,headTopY};
  expect(homeBubblePosition(anchor,'thought').y+23).toBeLessThan(headTopY);
  expect(homeBubblePosition(anchor,'speech').y+7).toBeLessThan(headTopY);
 }
});
it('keeps the ordinary home anchor placement unchanged',()=>{
 const anchor={x:180,y:250,width:390};
 expect(homeBubblePosition(anchor,'thought')).toEqual({x:218,y:244});
 expect(homeBubblePosition(anchor,'speech')).toEqual({x:180,y:205});
});
