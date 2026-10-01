/** Browser video is already upright; crop to the phone's viewfinder, never rotate its pixels. */
export function cameraCaptureLayout(sourceWidth: number, sourceHeight: number, portrait: boolean, maxEdge = 1440) {
    if (![sourceWidth, sourceHeight, maxEdge].every(n => Number.isFinite(n) && n > 0)) return null;
    const aspect = portrait ? 3 / 4 : 4 / 3;
    const sourceCropWidth = Math.min(sourceWidth, sourceHeight * aspect);
    const sourceCropHeight = sourceCropWidth / aspect;
    const scale = Math.min(1, maxEdge / Math.max(sourceCropWidth, sourceCropHeight));
    return {
        x: (sourceWidth - sourceCropWidth) / 2, y: (sourceHeight - sourceCropHeight) / 2,
        sourceWidth: sourceCropWidth, sourceHeight: sourceCropHeight,
        width: Math.max(1, Math.round(sourceCropWidth * scale)),
        height: Math.max(1, Math.round(sourceCropHeight * scale)),
    };
}

export function cameraIsPortrait(): boolean {
    // Screen orientation is unaffected by the on-screen keyboard and the camera dialog size.
    const orientation = typeof screen !== 'undefined' ? screen.orientation?.type : undefined;
    if (orientation) return orientation.startsWith('portrait');
    // iOS versions without Screen Orientation API still expose the physical orientation angle.
    if (typeof window !== 'undefined' && typeof window.orientation === 'number') return Math.abs(window.orientation) !== 90;
    return typeof window === 'undefined' || window.matchMedia('(orientation: portrait)').matches;
}
