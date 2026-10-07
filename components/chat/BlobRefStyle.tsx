import React, {useEffect, useState} from 'react';
import {resolveCssImageUrls} from '../../utils/cssImageAssets';

/** Keep persisted CSS independent of the short-lived browser object URLs. */
export default function BlobRefStyle({css}: {css: string}) {
    const [resolved, setResolved] = useState<{source: string; css: string; alive: () => boolean} | null>(null);
    useEffect(() => {
        if (!css.includes('blobref:')) return;
        let alive = true; let dispose: (() => void) | undefined;
        void resolveCssImageUrls(css, true).then(result => {
            if (!alive) {result.dispose(); return;}
            dispose = result.dispose; setResolved({source: css, css: result.css, alive: () => alive});
        }).catch(() => { /* Keep ordinary layout CSS usable if the asset store is unavailable. */ });
        return () => {alive = false; dispose?.();};
    }, [css]);
    return <style>{resolved?.source === css && resolved.alive() ? resolved.css : css}</style>;
}
