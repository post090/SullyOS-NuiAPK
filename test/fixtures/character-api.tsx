import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OSProvider, useOS } from '../../context/OSContext';
import Character from '../../apps/Character';
import Settings from '../../apps/Settings';
import DateSettings from '../../components/date/DateSettings';

function Preview() {
  const os = useOS();
  const [page, setPage] = useState('character');
  const seed = () => {
    os.updateApiConfig({ baseUrl: 'https://default.example/v1', apiKey: 'demo-only', model: 'default-model' });
    os.apiPresets.filter(p => ['日常对话', '创作模型'].includes(p.name)).forEach(p => os.removeApiPreset(p.id));
    os.addApiPreset('日常对话', { baseUrl: 'https://daily.example/v1', apiKey: 'demo-only', model: 'daily-model', stream: false, temperature: 0.85 }, { group: '日常' });
    os.addApiPreset('创作模型', { baseUrl: 'https://writing.example/v1', apiKey: 'demo-only', model: 'writing-model' }, { group: '写作' });
    os.setAvailableModels(['default-model', 'default-model-long-name-for-mobile-layout-review']);
  };
  return <div className="h-full max-w-md mx-auto flex flex-col bg-slate-50">
    <nav className="flex gap-4 px-4 py-2 text-xs shrink-0 border-b border-slate-200">
      <button onClick={seed}>加载演示配置</button>
      <button onClick={() => setPage('character')}>神经链接</button>
      <button onClick={() => setPage('settings')}>设置</button>
      <button onClick={() => setPage('date')}>场景布置</button>
    </nav>
    <main className="relative min-h-0 flex-1">{page === 'character' ? <Character /> : page === 'date' && os.characters[0] ? <DateSettings char={os.characters[0]} onBack={() => setPage('character')} /> : <Settings />}</main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<OSProvider><Preview /></OSProvider>);
