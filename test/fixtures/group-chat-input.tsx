import React from 'react';
import { createRoot } from 'react-dom/client';
import { OSProvider } from '../../context/OSContext';
import { MusicProvider } from '../../context/MusicContext';
import GroupChat from '../../apps/GroupChat';
createRoot(document.getElementById('root')!).render(<OSProvider><MusicProvider><GroupChat/></MusicProvider></OSProvider>);
