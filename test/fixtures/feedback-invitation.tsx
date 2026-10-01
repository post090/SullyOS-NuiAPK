import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FeedbackInvitationDialog } from '../../components/FeedbackInvitation';

function PhoneScene() {
    const [open, setOpen] = useState(true);
    return <div style={{ minHeight: '100dvh', background: '#f6f2e9', color: '#625b52', padding: '22px 24px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>09:41</span><span>● ▰</span></div>
        <div style={{ marginTop: 53, fontSize: 9, letterSpacing: 3 }}>SYSTEM ONLINE ————— 2026</div>
        <div style={{ marginTop: 18, fontSize: 10, letterSpacing: 3 }}>GOOD MORNING</div>
        <div style={{ font: '80px/1.2 Georgia, serif', letterSpacing: -6 }}>09:41</div>
        <div style={{ height: 82, borderRadius: 24, background: '#e9e4da', marginTop: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginTop: 25 }}>{['神经链接', '记忆宫殿', '电话', '小小窝', '查手机', '见面', '档案', '存钱罐'].map((title, index) => <div key={title} style={{ textAlign: 'center', fontSize: 9 }}><div style={{ height: 53, background: '#ebe6dd', borderRadius: 18, marginBottom: 9, display: 'grid', placeItems: 'center', fontSize: 25, color: '#aaa095' }}>{['♧', '✳', '♧', '⌂'][index % 4]}</div>{title}</div>)}</div>
        {!open && <button onClick={() => setOpen(true)} style={{ marginTop: 40, border: '1px solid #cdbfda', padding: '12px 25px', borderRadius: 12, background: '#f5effa', color: '#78628d', cursor: 'pointer' }}>再看一次</button>}
        {open && <FeedbackInvitationDialog onClose={() => setOpen(false)} />}
    </div>;
}

function Preview() {
    const [width, setWidth] = useState(390);
    const [version, setVersion] = useState(0);
    const [availableHeight, setAvailableHeight] = useState(window.innerHeight);
    useEffect(() => {
        const resize = () => setAvailableHeight(window.innerHeight);
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);
    const height = width === 320 ? 640 : 780;
    const scale = Math.max(.4, Math.min(1, (availableHeight - 154) / (height + 16)));
    return <main style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <header style={{ width: '100%', maxWidth: 510, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
            <div><div style={{ fontSize: 10, color: '#908276', letterSpacing: 2 }}>糯米机 · 作者来信</div><h1 style={{ margin: '7px 0 0', fontSize: 21, color: '#51473f' }}>一张想蹲 repo 的小纸条</h1></div>
            <button onClick={() => setVersion(v => v + 1)} style={{ border: 0, borderRadius: 20, background: '#dad0e3', color: '#715d82', padding: '8px 14px', cursor: 'pointer' }}>重播</button>
        </header>
        <div style={{ width: (width + 16) * scale, height: (height + 16) * scale }}>
            <div style={{ padding: 8, width: width + 16, borderRadius: 39, background: '#514b48', boxShadow: '0 24px 64px #57463725', boxSizing: 'border-box', transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <iframe key={version} title="弹窗手机预览" src="?phone" style={{ display: 'block', width, height, border: 0, borderRadius: 32, background: '#f6f2e9' }} />
            </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>{[390, 320].map(value => <button key={value} onClick={() => setWidth(value)} style={{ padding: '8px 14px', border: '1px solid #cfc3d8', borderRadius: 18, color: '#766381', background: width === value ? '#f5eff9' : 'transparent', cursor: 'pointer' }}>{value === 390 ? '常规屏幕' : '小屏幕'}</button>)}</div>
    </main>;
}

createRoot(document.getElementById('root')!).render(location.search.includes('phone') ? <PhoneScene /> : <Preview />);
