import React, { useLayoutEffect, useRef, useState } from 'react';

/** Fit a complete passive object into the foreground without resizing the cast. */
export function SARDialogueProp({ kind, interactive, children }: { kind: string; interactive?: boolean; children: React.ReactNode }) {
    const frame = useRef<HTMLDivElement>(null), art = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    useLayoutEffect(() => {
        if (interactive || !frame.current || !art.current) return;
        const fit = () => {
            if (!frame.current || !art.current) return;
            setScale(Math.min(1, Math.max(0, frame.current.clientHeight - 24) / Math.max(1, art.current.scrollHeight + 12)));
        };
        const observer = new ResizeObserver(fit);
        observer.observe(frame.current); observer.observe(art.current); fit();
        return () => observer.disconnect();
    }, [kind, interactive]);
    return <div className={`srf-prop srf-prop-${kind} ${interactive ? 'is-interactive' : 'is-fitted'}`}>
        <div className="srf-prop-content" ref={frame}>
            <div className="srf-prop-art" ref={art} style={interactive ? undefined : { transform: `scale(${scale})` }}>{children}</div>
        </div>
    </div>;
}
