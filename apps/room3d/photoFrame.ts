export const photoFrames={screen:{label:'全屏',aspect:3/4},portrait:{label:'竖幅 3:4',aspect:3/4},tall:{label:'全身 9:16',aspect:9/16},landscape:{label:'横幅 16:9',aspect:16/9},cinema:{label:'电影 2.39:1',aspect:2.39},square:{label:'方形 1:1',aspect:1},polaroid:{label:'奶油拍立得',aspect:4/5},sticker:{label:'爱心大头贴',aspect:3/4},collage:{label:'四格贴纸',aspect:4/5}};
export type PhotoFrame=keyof typeof photoFrames;
// Fill a normal full-body portrait without making the room the main subject.
export const DEFAULT_PHOTO_ZOOM=1.5;
/** Portrait presets follow the viewfinder orientation; authored papers keep their layout. */
export function photoFrameView(format:PhotoFrame,width:number,height:number){
 const frame=photoFrames[format],wide=width>height;
 if(format==='screen'&&width>0&&height>0)return {...frame,aspect:width/height};
 if(wide&&format==='portrait')return {label:'横幅 4:3',aspect:4/3};
 if(wide&&format==='tall')return {label:'全身 16:9',aspect:16/9};
 return frame;
}
export type PhotoRenderOptions={aspect?:number;quality?:'moving'|'preview'|'export'};
export function photoSize(aspect:number,quality:PhotoRenderOptions['quality']='preview'){
 const ratio=Number.isFinite(aspect)&&aspect>0?Math.max(.4,Math.min(3,aspect)):16/9;
 const edge=quality==='export'?2560:quality==='moving'?768:1280;
 return {width:Math.round(ratio>=1?edge:edge*ratio),height:Math.round(ratio>=1?edge/ratio:edge)};
}
/** Screen deltas transformed back into the temporarily rotated viewfinder. */
export function photoDrag(dx:number,dy:number,rotated:boolean){return rotated?{dx:dy,dy:-dx}:{dx,dy};}
