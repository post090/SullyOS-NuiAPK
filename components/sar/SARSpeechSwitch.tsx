import React from 'react';
import { ArrowsLeftRight, Cpu } from '@phosphor-icons/react';
import './sar-speech.css';

export function SARSpeechSwitch({ truth, onToggle, moduleTitle, className = '' }: {
    truth: boolean; onToggle: () => void; moduleTitle?: string; className?: string;
}) {
    return <button type="button" className={`sar-speech-switch control-panel ${className}`} data-sar-view={truth ? 'truth' : 'surface'}
        aria-label={truth ? '显示污染台词' : '查看原台词'} aria-pressed={truth}
        title={`${moduleTitle || '临时模块'} · 当前${truth ? '原台词' : '污染台词'}`}
        onPointerDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); event.preventDefault(); onToggle(); }}>
        <Cpu size={13}/><strong>{truth ? '原台词' : '污染台词'}</strong><ArrowsLeftRight size={11}/>
        <span>{truth ? '查看污染' : '查看原话'}</span>
    </button>;
}
