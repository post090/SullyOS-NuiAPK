import {renderChatDecorationSample} from '../../components/chat/ChatDecorationSample';
import {CHAT_PREVIEW_SCENES,CHAT_TYPE_SAMPLES} from '../../utils/chatPreviewFixtures';
import darkPreset from './acid-orbit.sully.json';
import lightPreset from './acid-orbit-lavender.sully.json';
const preset=new URLSearchParams(location.search).get('theme')==='lavender'?lightPreset:darkPreset;

CHAT_PREVIEW_SCENES.push({id:'acid-orbit',label:'整套效果',messages:[
 {...CHAT_TYPE_SAMPLES.text,id:9001,content:'今天的天空也很漂亮。\n你在做什么？'},
 {...CHAT_TYPE_SAMPLES.text,id:9002,role:'user',content:'在赶文件……！\n但看到你就感觉好多了 ✧'},
 {...CHAT_TYPE_SAMPLES.text,id:9003,content:'<语音>今夜也有我在。</语音>'},
 {...CHAT_TYPE_SAMPLES.transfer,id:9004,role:'user',metadata:{amount:520,note:'星光会一直陪着你。',status:'accepted'}},
 {...CHAT_TYPE_SAMPLES.text,id:9005,content:'收到啦 ✧\n这份心意我好好珍藏。\n以后也一起看更多的星空吧。'},
 {...CHAT_TYPE_SAMPLES.collaboration_file,id:9006,role:'user'},
 {...CHAT_TYPE_SAMPLES.music_card,id:9007},
 {...CHAT_TYPE_SAMPLES.text,id:9008,content:'晚安，明天见。',metadata:{thinkingChain:'想把今天没说完的话，留给下一次见面。'}}
]});
const download=document.querySelector<HTMLAnchorElement>('a[download]');
if(download)download.href=preset===lightPreset?'./acid-orbit-lavender.sully.json':'./acid-orbit.sully.json';
const host=document.getElementById('phone')!.attachShadow({mode:'open'});
// Reproduce the app's status-bar inset without changing device or user settings.
const chromeTop=Math.max(0,Math.min(100,Number(new URLSearchParams(location.search).get('chrome'))||0));
const menu=document.getElementById('scenes')!;
function show(id:string){
 const {markup,css}=renderChatDecorationSample(new URLSearchParams(location.search).has('baseline') ? {...preset,parts:{...preset.parts,css:''}} : preset,id,undefined,{panel:new URLSearchParams(location.search).has('panel')});
 host.innerHTML=`<style>${css}\n:host{display:block;height:100%}.beauty-preview-body{width:100%;height:100%;--chrome-top:${chromeTop}px}.sample-chat{height:100%}.sample-chat .sully-schedule-change{position:relative!important;left:auto!important;top:auto!important;transform:none!important;animation:none!important;opacity:1!important;margin:8px auto 20px}</style><div class="beauty-preview-body">${markup}</div>`;
 menu.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===id)));
}
for(const scene of [{id:'acid-orbit',label:'整套效果'},...CHAT_PREVIEW_SCENES.filter(s=>s.id!=='acid-orbit'&&s.id!=='all')]){
 const b=document.createElement('button');b.textContent=scene.label;b.dataset.scene=scene.id;b.onclick=()=>show(scene.id);menu.append(b);
}
const initialScene=new URLSearchParams(location.search).get('scene');
show(CHAT_PREVIEW_SCENES.some(s=>s.id===initialScene)?initialScene!:'acid-orbit');
