/** Native persists work before signaling. Check again on mount and when the WebView resumes. */
export function watchNativeQueue(
  event: 'sully-native-music-action' | 'sully-native-timer-ready',
  drain: () => Promise<void>,
): () => void {
  let disposed = false;
  let running = false;
  let pending = false;
  const wake = async () => {
    pending = true;
    if (running) return;
    running = true;
    try {
      while (pending && !disposed) {
        pending = false;
        await drain();
      }
    } catch (error) {
      console.warn('[NativeRuntime] queue recovery failed', event, error);
    } finally {
      running = false;
    }
  };
  const resume = () => { if (!document.hidden) void wake(); };
  window.addEventListener(event, wake);
  document.addEventListener('visibilitychange', resume);
  void wake();
  return () => {
    disposed = true;
    window.removeEventListener(event, wake);
    document.removeEventListener('visibilitychange', resume);
  };
}
