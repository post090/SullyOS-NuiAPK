// Full Kanata + real providers, fresh browser storage; never part of the production entry.
import React from 'react';
import DevDebugPanel from '../../components/DevDebugPanel';
import { createRoot } from 'react-dom/client';
import { OSProvider } from '../../context/OSContext';
import { MusicProvider } from '../../context/MusicContext';
import VRWorldApp from '../../apps/VRWorldApp';
import { VRScheduler } from '../../utils/vrWorld/scheduler';
(window as any).kanataQA = { scheduler: VRScheduler };
if (!localStorage.getItem('vr_sar_club_state_v1')) localStorage.setItem('vr_sar_club_state_v1',JSON.stringify({version:1,updateSeenVersion:1,npcPreference:new URLSearchParams(location.search).get('npcs')==='show'?'show':'hide',caianMet:false}));
localStorage.setItem('vr_help_seen','1');
createRoot(document.getElementById('root')!).render(<OSProvider><MusicProvider><VRWorldApp/><DevDebugPanel/></MusicProvider></OSProvider>);
