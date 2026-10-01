/**
 * 聊天语音条：什么时候合成、合成完要不要立刻响。
 *
 * 一句话版本：角色开了「收到就自动播放」，AI 的语音消息才会自己合成并响；
 * 没开就只留一条空语音条，用户点了才合成，合成完直接播。
 */

/**
 * AI 消息到达后要不要顺手把语音合成出来。
 *
 * 只认「收到就自动播放」这一个开关：没开的话合出来也不会响，等于替用户白花一次 TTS 调用
 * （还占着额度和时间）。空语音条照常显示，想听点一下就合成——那条路走的是下面的手动分支，
 * 合完立刻播，体验上只多等一次合成。
 */
export function shouldAutoGenerateVoice(opts: {
  /** 角色的「收到就自动播放」开关，未设置视作关 */
  autoPlayEnabled?: boolean;
}): boolean {
  return !!opts.autoPlayEnabled;
}

/**
 * 语音合成完要不要立刻响。两条规则各有来由，别合并简化：
 *  - AI 自动发来的语音，跟着「收到就自动播放」走（也只有开了这个开关才会自动合成）。
 *  - 用户主动要的语音（长按「转换语音」、点还没合成的空语音条），无论开关怎么设都播——
 *    他点这一下的意思就是「我现在要听」，还要再点一次播放属于白跑一趟。
 */
export function shouldAutoPlayGeneratedVoice(opts: {
  /** 这次合成是 AI 消息到达后自动触发的（false = 用户主动点的） */
  autoTriggered: boolean;
  /** 角色的「收到就自动播放」开关，未设置视作关 */
  autoPlayEnabled?: boolean;
}): boolean {
  if (!opts.autoTriggered) return true;
  return !!opts.autoPlayEnabled;
}

const SILENT_AUDIO = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA';
const audioOperations = new WeakMap<HTMLAudioElement, { priming: boolean; source?: string }>();

export const isVoiceAudioPriming = (audio: HTMLAudioElement): boolean => {
  const operation = audioOperations.get(audio);
  return operation?.priming === true && audio.src === operation.source;
};

/** Must run inside the click handler, before waiting for synthesis/network. */
export function primeVoiceAudio(audio: HTMLAudioElement, silence = SILENT_AUDIO): void {
  if (!audio.paused && audio.src) return;
  const operation = { priming: true, source: silence };
  audioOperations.set(audio, operation);
  audio.src = silence;
  try {
    void Promise.resolve(audio.play()).then(() => {
      if (audioOperations.get(audio) !== operation || audio.src !== silence) return;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      operation.priming = false;
    }, () => { operation.priming = false; });
  } catch { operation.priming = false; }
}

export function stopVoiceAudio(audio: HTMLAudioElement): void {
  audioOperations.delete(audio);
  audio.onended = null;
  audio.onerror = null;
  audio.onpause = null;
  audio.pause();
}

export function voicePlaybackErrorMessage(error: unknown, replayLabel = '语音条'): string {
  if ((error as { name?: string })?.name === 'NotAllowedError') {
    return `浏览器未允许播放，请点“${replayLabel}”继续；无需重新生成语音。`;
  }
  return `音频加载或播放失败，请点“${replayLabel}”重试播放；若是旧音频链接，可能已过期。`;
}

/** Report playback only after play() succeeds; stale attempts cannot reset a newer voice. */
export async function playVoiceAudio(audio: HTMLAudioElement, url: string, callbacks: {
  onPlaying: () => void; onStopped: () => void; onError: (error: unknown) => void;
}): Promise<void> {
  const operation = { priming: false };
  audioOperations.set(audio, operation);
  let failed = false;
  const isCurrent = () => audioOperations.get(audio) === operation;
  const fail = (error: unknown) => {
    if (!isCurrent() || failed) return;
    failed = true;
    callbacks.onStopped();
    callbacks.onError(error);
  };
  audio.onended = () => { if (isCurrent()) callbacks.onStopped(); };
  audio.onpause = () => { if (isCurrent() && audio.paused) callbacks.onStopped(); };
  audio.onerror = () => fail(audio.error);
  try {
    audio.src = url;
    await audio.play();
    if (isCurrent() && !failed && !audio.paused) callbacks.onPlaying();
  } catch (error) { fail(error); }
}

/** Remote fallbacks must stay out of WebAudio: cross-origin media sources output silence. */
export function canAnalyzeVoiceSource(url: string, pageOrigin?: string): boolean {
  if (/^(blob:|data:audio\/)/i.test(url)) return true;
  try {
    const origin = pageOrigin ?? (typeof location !== 'undefined' ? location.origin : undefined);
    return !!origin && new URL(url, origin).origin === origin;
  } catch { return false; }
}
