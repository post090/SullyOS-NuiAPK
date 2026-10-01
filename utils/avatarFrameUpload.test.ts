import {describe,it,expect} from 'vitest';
import {uploadedAvatarFrameCss,UPLOADED_AVATAR_FRAME_STYLE} from './avatarFrameUpload';
import {avatarDecorationImageStyle,ANNIVERSARY_FRAME_STYLE} from './anniversaryGifts';
describe('新上传头像框与周年庆定位一致',()=>{
  it('长图保留完整画布比例，不再塞进正方形背景盒',()=>{
    const css=uploadedAvatarFrameCss('data:image/png;base64,test',1080,1440);
    expect(css).toContain('aspect-ratio: 1080 / 1440');expect(css).toContain('width: 160%');
    expect(css).not.toContain('inset: -10%');
    for(const size of [28,36,48])expect(avatarDecorationImageStyle(UPLOADED_AVATAR_FRAME_STYLE,size)).toEqual(avatarDecorationImageStyle(ANNIVERSARY_FRAME_STYLE,size));
  });
  it('正方形保持原比例，无效尺寸拒绝生成；已保存的微调仍优先',()=>{
    expect(uploadedAvatarFrameCss('image',800,800)).toContain('aspect-ratio: 800 / 800');
    expect(()=>uploadedAvatarFrameCss('image',0,100)).toThrow();
    expect(avatarDecorationImageStyle({avatarDecorationX:45,avatarDecorationScale:1.2},40)).toMatchObject({left:'45%',width:'48px'});
  });
});
