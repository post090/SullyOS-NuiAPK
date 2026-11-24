import React, { useLayoutEffect, useRef, useState } from 'react';
import { useOS } from '../../context/OSContext';
import { trackEvent } from '../../utils/analytics';
import { copyTextToClipboard } from '../../utils/clipboard';

export default function CopyMessageButton({ text, group, onClose }: {
    text: string;
    group?: boolean;
    onClose: () => void;
}) {
    const { addToast } = useOS();
    const [pending, setPending] = useState(false);
    const mounted = useRef(false);
    useLayoutEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    const copy = async () => {
        if (pending) return;
        setPending(true);
        const copied = await copyTextToClipboard(text);
        if (copied) {
            if (group) trackEvent('复制一条群消息文字');
            else trackEvent('复制一条消息');
        }
        // The system clipboard can finish after the user opens a different message.
        if (!mounted.current) return;
        setPending(false);
        if (copied) {
            addToast('已复制到剪贴板', 'success');
            onClose();
        } else {
            addToast('未能写入剪贴板，请重试', 'error');
        }
    };

    return <button type="button" onClick={copy} disabled={pending} aria-busy={pending} className="w-full py-3 bg-slate-50 text-slate-700 font-medium rounded-2xl active:bg-slate-100 transition-colors flex items-center justify-center gap-2">
        复制文字
    </button>;
}
