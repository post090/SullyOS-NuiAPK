import {it,expect} from 'vitest';
import {validateDecoration,decorationPatches} from './chatDecoration';
import {validateBeautyPackage} from './beautyShareContract';
import {belongsInBeautyLibrary,decorationCategories} from './beautyCategories';
import {decorationPreviewScenes,decorationThumbnailPart} from './decorationPreviewScenes';
import {stampBeautyCss,cssImportPreset} from './beautyCssAttribution';
import {makeWorkshopPreset,checkWorkshopCss} from './decorationWorkshop';
const pack=(parts:unknown)=>({format:'sullyos-chat-decoration',version:1,name:'样式',parts});
it.each(['schedule','journal'] as const)('%s shares only appearance, keeps app scope and round trips signed CSS',async category=>{
 const css=category==='schedule'?'.sully-schedule-card { color:red; }':'.sully-journal-root { color:red; }';
 const preset=validateDecoration(pack({[category]:{preset:'original',customCss:css,entries:['private diary'],slots:['private plan'],characterId:'private-role',apiKey:'private-key'}}));
 expect(JSON.stringify(preset)).not.toContain('private');
 expect(decorationCategories(preset)).toEqual([category]);
 expect(belongsInBeautyLibrary([category],'appearance')).toBe(true);
 expect(belongsInBeautyLibrary([category],'chat')).toBe(false);
 expect(validateBeautyPackage(preset).data).toEqual(preset);
 expect(decorationPreviewScenes(preset).map(s=>s.id)).toEqual([category==='schedule'?'schedule-card':'journal-app']);
 expect(decorationThumbnailPart(preset)).toBe(category);
 const imported=cssImportPreset(stampBeautyCss(css,{name:'样式',credit:'作者',category,allowRemix:false}),'file');
 expect(imported.preset.parts[category]?.customCss).toBe(css);
 expect(imported.origin?.allowRemix).toBe(false);
 expect(makeWorkshopPreset(category).parts[category]).toBeDefined();
 expect(()=>checkWorkshopCss(category,'.sully-chat-root {color:red;}')).toThrow();
 const changes=await decorationPatches(preset,[category],'global',{} as any,{} as any);
 expect(changes.character).toEqual({});
 expect(changes.theme).toEqual({[category==='schedule'?'scheduleCardAppearance':'journalAppearance']:preset.parts[category]});
});
it('keeps chat works out of Appearance and desktop works out of Chat',()=>{
 expect(belongsInBeautyLibrary(['chat','whitebox','psyche'],'appearance')).toBe(false);
 expect(belongsInBeautyLibrary(['chat','whitebox','psyche'],'chat')).toBe(true);
 expect(belongsInBeautyLibrary(['appearance'],'chat')).toBe(false);
});
it('rejects mixed app/chat and multi-app bundles so editors cannot drop hidden parts',()=>{
 for(const parts of [{schedule:{preset:'original'},css:'.sully-chat-root{}'},{journal:{preset:'original'},psyche:{styleId:'echo'}},{schedule:{preset:'original'},journal:{preset:'original'}}]){
  expect(()=>validateDecoration(pack(parts))).toThrow();
  expect(()=>validateBeautyPackage(pack(parts))).toThrow();
 }
});
