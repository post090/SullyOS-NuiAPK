import React from 'react';
import {createRoot} from 'react-dom/client';
import {OSProvider} from '../../context/OSContext';
import AppIconEditor from '../../components/appearance/AppIconEditor';
createRoot(document.getElementById('root')!).render(<OSProvider><main style={{padding:16,maxWidth:480,margin:'auto'}}><AppIconEditor/></main></OSProvider>);
