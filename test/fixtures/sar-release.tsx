// Isolated automated contexts only. Exposes the actual Settings backup pipeline.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OSProvider, useOS } from '../../context/OSContext';
import { SARUpdatePopup } from '../../components/os/SARUpdatePopup';
import { UpdateNotificationController } from '../../components/UpdateNotificationEvent';
import { MusicProvider } from '../../context/MusicContext';
const Chat = React.lazy(() => import('../../apps/Chat'));
const homes = {
    mobilegame: React.lazy(() => import('../../components/os/MobileGameHome')),
    tamagotchi: React.lazy(() => import('../../components/os/TamagotchiHome')),
    companion: React.lazy(() => import('../../components/os/CompanionHome')),
};

function Harness() {
    const os = useOS();
    const [closed, setClosed] = useState('');
    useEffect(() => { (window as any).releaseQA = os; });
    const skin = new URLSearchParams(location.search).get('desktop') as keyof typeof homes;
    if (skin && homes[skin]) {
        const Home = homes[skin];
        return <MusicProvider><React.Suspense fallback={<p>桌面载入中</p>}><Home/></React.Suspense><output hidden data-active-app={os.activeApp}/></MusicProvider>;
    }
    if (new URLSearchParams(location.search).has('backup')) return <p>系统备份测试就绪</p>;
    if (new URLSearchParams(location.search).has('chat')) return <MusicProvider><React.Suspense fallback={<p>聊天载入中</p>}><Chat/></React.Suspense></MusicProvider>;
    if (closed) return <p data-result={closed}>{closed}</p>;
    if (new URLSearchParams(location.search).has('queue')) return <UpdateNotificationController onClose={() => setClosed('queue-closed')}/>;
    return <SARUpdatePopup onDone={() => setClosed('dismissed')} onVisit={() => setClosed('visit')} onGuide={() => setClosed('guide')}/>;
}
createRoot(document.getElementById('root')!).render(<OSProvider><Harness/></OSProvider>);
