/** Copy the original text, including line breaks, from a user-initiated action. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch { /* Some WebViews only support copying a document selection. */ }

    if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
    const previousFocus = document.activeElement;
    const textarea = document.createElement('textarea');
    try {
        textarea.value = text;
        textarea.readOnly = true;
        textarea.style.cssText = 'position:fixed;left:-9999px;opacity:0;pointer-events:none';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        return document.execCommand('copy');
    } catch {
        return false;
    } finally {
        const restoreFocus = document.activeElement === textarea;
        textarea.remove();
        if (restoreFocus && previousFocus instanceof HTMLElement && previousFocus.isConnected) {
            previousFocus.focus({ preventScroll: true });
        }
    }
}
