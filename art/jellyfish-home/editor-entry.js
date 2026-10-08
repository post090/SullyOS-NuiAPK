import {mountHomeEditor} from '../../apps/room3d/editor.js';
import '../../apps/room3d/editor.css';
const host=document.querySelector('#home');
const editor=await mountHomeEditor(host,{assetBase:new URL('./',import.meta.url).href,storageKey:'sully-jelly-home-editor-v1'});
window.__homeEditor=editor;
window.render_game_to_text=()=>JSON.stringify(editor.inspect());
window.advanceTime=ms=>editor.advanceTime(ms);
