import React from 'react';
import roomArt from '../../assets/sar-club-room.png';
import caianChibi from '../../assets/sar/caian-chibi.png';
import aivenChibi from '../../assets/sar/aiven-chibi.png';
import type { FamiliarityEffect } from '../../utils/vrWorld/sarFamiliarity/types';
import './sar-artifacts.css';

export function SARArtifactSeal({ className = '' }: { className?: string }) {
    return <svg className={`sar-artifact-seal ${className}`} viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="28"/><circle cx="32" cy="32" r="23" strokeDasharray="1 3"/><path d="m32 13 15 19-15 19-15-19Z M13 32h38M32 13v38"/><path d="m24 32 8-10 8 10-8 10Z"/><circle cx="32" cy="32" r="3" fill="currentColor" stroke="none"/></svg>;
}

export function SARMemoryObject({ name }: { name: string }) {
    return <div className="sar-memory-shadow"><div className="srf-fx-memory sar-memory-object">
        <div className="sar-memory-top"><span>SAR</span><small>ARCHIVE / 01</small></div><i className="sar-memory-lock" aria-hidden="true"/>
        <div className="sar-memory-label"><small>PERSONAL ARCHIVE</small><b>{name}</b><span>彼方 / KANATA</span><i aria-hidden="true"/></div>
        <div className="sar-memory-engraving"><SARArtifactSeal/><span>FOR THE<br/>DAYS AHEAD</span></div>
        <div className="srf-fx-memory-contacts" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map(i => <i key={i}/>)}</div>
        <i className="sar-memory-screw is-left" aria-hidden="true"/><i className="sar-memory-screw is-right" aria-hidden="true"/>
    </div></div>;
}

/** Tiny, static physical-object previews; no interactive scene or WebGL renderer on the shelf. */
export function SARArtifactPreview({ kind }: { kind: FamiliarityEffect['kind'] }) {
    return <span className={`sar-artifact-preview is-${kind}`} aria-hidden="true">
        {kind === 'memory-card' ? <SARMemoryObject name="彼方"/> : kind === 'photo-studio' ? <span className="sar-mini-photo"><span><img src={roomArt} alt=""/><img src={caianChibi} alt=""/><img src={aivenChibi} alt=""/></span><small>SAR / OUR FIRST MEETING</small></span>
            : kind === 'meeting-record' ? <span className="sar-mini-document"><small>SAR / ARCHIVE</small><b>会议记录</b><i/><i/><i/><span>Caian</span></span>
                : <span className="sar-mini-identity"><strong>SAR</strong><SARArtifactSeal/><span>MEMBER</span><b>0001</b><i/></span>}
    </span>;
}
