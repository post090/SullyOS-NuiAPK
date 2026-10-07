/** Keep the canvas covered until a correctly framed render has had a paint opportunity. */
export function revealLive2DAfterPaint(prepare: () => boolean, reveal: () => void, onError: (error: unknown) => void) {
    let cancelled = false;
    let prepared = false;
    let frame = 0;
    const tick = () => {
        if (cancelled) return;
        try {
            const ready = prepare();
            if (ready && prepared) { reveal(); return; }
            prepared = ready;
            frame = requestAnimationFrame(tick);
        } catch (error) { onError(error); }
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(frame); };
}
