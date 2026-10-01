import {ANNIVERSARY_FRAME_STYLE} from './anniversaryGifts';

/** New uploads use the anniversary fit; saved/manual adjustments are not migrated. */
export const UPLOADED_AVATAR_FRAME_STYLE={
  avatarDecorationX:ANNIVERSARY_FRAME_STYLE.avatarDecorationX,
  avatarDecorationY:ANNIVERSARY_FRAME_STYLE.avatarDecorationY,
  avatarDecorationScale:ANNIVERSARY_FRAME_STYLE.avatarDecorationScale,
  avatarDecorationRotate:0,
};

export function uploadedAvatarFrameCss(image:string,width:number,height:number):string{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('头像框图片尺寸无效');
  const fit=UPLOADED_AVATAR_FRAME_STYLE;
  // The previous square inset box shrank portrait artwork vertically. Match the
  // real chat's width-based <img height=auto> positioning, keeping the whole image.
  return `.sully-chat-avatar-wrap::after {
  content: ''; position: absolute; inset: auto;
  left: ${fit.avatarDecorationX}%; top: ${fit.avatarDecorationY}%;
  width: ${fit.avatarDecorationScale*100}%; height: auto; aspect-ratio: ${width} / ${height};
  transform: translate(-50%, -50%) rotate(0deg);
  background: url(${JSON.stringify(image)}) center / 100% 100% no-repeat;
  pointer-events: none; z-index: 2;
}
.sully-chat-message-avatar-img { border-radius: 50%; }`;
}

export async function readAvatarFrameCss(image:string):Promise<string>{
  const img=new Image();
  const loaded=new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(Error('头像框图片读取失败'));});
  img.src=image;await loaded;
  return uploadedAvatarFrameCss(image,img.naturalWidth,img.naturalHeight);
}
