import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ChatCamera from '../../components/chat/ChatCamera';
import ChatImage from '../../components/chat/ChatImage';
import { createBuiltinSullyLive2DConfig } from '../../utils/builtinSullyLive2D';
import type { CharacterProfile } from '../../types';
import chibi from '../../assets/sar/caian-chibi.png';

const character = { id: 'qa', name: 'QA', vrState: { chibi: { img: chibi } }, sprites: { chibi, normal: chibi, happy: chibi }, dateSkinSets: [{ id: 'coat', name: '冬装', sprites: { sad: chibi } }], chibiStudio: { like520: { img: chibi } }, videoAvatar: createBuiltinSullyLive2DConfig() } as unknown as CharacterProfile;
// Opt-in synthetic landscape sensor: orientation QA never opens a physical camera.
const synthetic = new URLSearchParams(location.search).has('synthetic');
const interruptedStart = new URLSearchParams(location.search).has('interruptedStart');
let syntheticRequests = 0, syntheticStream: MediaStream | null = null;
const fakeOrientation = Object.assign(new EventTarget(), { type: 'portrait-primary' });
if (synthetic) {
    Object.defineProperty(screen, 'orientation', { configurable: true, value: fakeOrientation });
    navigator.mediaDevices.getUserMedia = async () => {
        syntheticRequests++;
        const sensor = document.createElement('canvas'); sensor.width = 1280; sensor.height = 720;
        const ctx = sensor.getContext('2d')!;
        ctx.fillStyle = '#dce9e4'; ctx.fillRect(0, 0, 1280, 720);
        ctx.fillStyle = '#8bada0'; ctx.fillRect(0, 500, 1280, 220);
        ctx.fillStyle = '#d88977'; ctx.fillRect(580, 230, 120, 220);
        ctx.fillStyle = '#293f37'; ctx.font = '40px sans-serif'; ctx.fillText('UP ↑', 570, 130);
        ctx.fillText('LEFT', 20, 400); ctx.fillText('RIGHT', 1120, 400);
        syntheticStream = sensor.captureStream(10);
        if (interruptedStart && syntheticRequests === 1) syntheticStream.getTracks().forEach(track => track.stop());
        return syntheticStream;
    };
}
function Fixture() {
    const [open, setOpen] = useState(true), [result, setResult] = useState('');
    return <>{synthetic && <nav style={{position:'fixed',left:0,bottom:0,zIndex:20000,background:'white'}} aria-label="测试方向">
        <button onClick={() => { fakeOrientation.type='portrait-primary';fakeOrientation.dispatchEvent(new Event('change')); }}>模拟竖持</button>
        <button onClick={() => { fakeOrientation.type='landscape-primary';fakeOrientation.dispatchEvent(new Event('change')); }}>模拟横持</button>
        <button onClick={() => { syntheticStream?.getVideoTracks().forEach(track => { track.stop(); track.dispatchEvent(new Event('ended')); }); }}>模拟摄像头断开</button>
    </nav>}<button onClick={() => setOpen(true)}>相册</button><output>{result ? '已接收照片' : ''}</output>{result && <><img alt="已发送照片" src={result} /><ChatImage value={result} selectionMode={false} /></>}{open && <ChatCamera character={character} onClose={() => setOpen(false)} onGallery={() => { setResult(''); setOpen(false); }} onCapture={file => { const reader = new FileReader(); reader.onload = () => setResult(String(reader.result)); reader.readAsDataURL(file); }} />}</>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
