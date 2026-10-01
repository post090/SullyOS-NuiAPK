// Isolated artwork preview. No providers, account data or model requests.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import SARClubRoom from '../../apps/vrWorld/SARClubRoom';

function Fixture() {
    const [lastAction, setLastAction] = useState('');
    return <main className="qa-shell">
        <SARClubRoom onOpenGacha={() => setLastAction('gacha')} onOpenCabinet={() => setLastAction('cabinet')}
            onOpenModuleShop={() => setLastAction('modules')} onOpenFishingMarket={entry => setLastAction(entry)} />
        <header className="qa-heading"><small>PAGE 02 · ACTIVITY SPACE</small><h1>SAR 活动室</h1></header>
        <output className="qa-action" data-testid="last-action">{lastAction}</output>
    </main>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
