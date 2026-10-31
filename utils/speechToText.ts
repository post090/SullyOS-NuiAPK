/**
 * Unified speech-to-text (STT) — used by the Call app for voice input.
 *
 * Supports four user-selectable STT routes:
 *   - 'minimax'    → MiniMax official ASR (`POST /v1/speech_to_text`, model `asr-1.0`)
 *   - 'fishaudio'  → Fish Audio official ASR (`POST /v1/asr`, model `transcribe-1-pro`)
 *   - 'elevenlabs' → ElevenLabs official Scribe (`POST /v1/speech-to-text`, model `scribe_v2`)
 *   - 'browser'    → Browser `SpeechRecognition` / Capacitor native speech recognition (free)
 *
 * Strict policy:
 *   - Paid STT providers are only selectable/usable when the corresponding official platform
 *     API Key is configured.
 *   - Never fall back to unrelated third-party dialogue LLM endpoints or non-MiniMax keys.
 */
import { Capacitor } from '@capacitor/core';
import type { APIConfig, SttProvider } from '../types';
import { normalizeApiKey } from './minimaxApiKey';
import { getMinimaxRegion, normalizeMinimaxRegion } from './minimaxEndpoint';
import { getProxyWorkerUrl } from './proxyWorker';
import { isStaticWebDeployment } from './staticWebDeployment';

export interface SttCallbacks {
  /** Fired repeatedly with the best-so-far transcript (interim + final, browser mode). */
  onPartial?: (text: string) => void;
  /** Fired once with the final transcript when recognition settles. */
  onFinal?: (text: string) => void;
  /** Fired when an API provider starts/finishes uploading & transcribing recorded audio. */
  onTranscribing?: (transcribing: boolean) => void;
  /** Fired on any recognition error (already turned into a friendly message). */
  onError?: (message: string) => void;
  /** Fired when the session ends for any reason (success, error, or stop). */
  onEnd?: () => void;
  /** Cloud mode only: mic input level 0..1, ~10 times/sec — drives the waveform UI. */
  onLevel?: (level: number) => void;
  /** Cloud mode only: recording stopped, upload/recognition in flight — show a busy state. */
  onRecognizing?: () => void;
  /** Cloud mode only: 录音结束、拿到完整音频 Blob（面试音频说话状态分析用；系统/浏览器识别拿不到音频流，不触发）。 */
  onAudioBlob?: (blob: Blob) => void;
}

export interface SttSession {
  /** Stop listening (and trigger transcription for API providers). Safe to call multiple times. */
  stop: () => void;
}

/**
 * Fork 保留的通用云端 STT 配置（OpenAI 兼容 /v1/audio/transcriptions，如 SiliconFlow
 * SenseVoice / Groq Whisper）。上游改成了官方三厂商模型（SttProvider），但 fork 的
 * 面试语音练习（JobHuntApp / CallApp 的 sttOverride）需要任意兼容端点，走 startCloudStt。
 */
export interface SttProviderConfig {
  provider?: 'system' | 'cloud';
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface SttProviderOption {
  id: SttProvider;
  label: string;
  shortLabel: string;
  desc: string;
  keyHint: string;
}

export const STT_PROVIDER_OPTIONS: SttProviderOption[] = [
  {
    id: 'minimax',
    label: 'MiniMax ASR',
    shortLabel: 'MiniMax',
    desc: '海螺官方 asr-1.0 · 支持中/粤/英/日等多语种与中英混说',
    keyHint: '需先填写 MiniMax API Key',
  },
  {
    id: 'fishaudio',
    label: '鱼声 Fish ASR',
    shortLabel: '鱼声 Fish',
    desc: '官方 transcribe-1-pro · 口语与多语种转写准确',
    keyHint: '需先填写鱼声 Fish Audio Key',
  },
  {
    id: 'elevenlabs',
    label: 'ElevenLabs Scribe',
    shortLabel: 'ElevenLabs',
    desc: '官方 Scribe v2 · 90+ 语种高精度语音转写',
    keyHint: '需先填写 ElevenLabs API Key',
  },
  {
    id: 'browser',
    label: '浏览器 / 系统自带（免费）',
    shortLabel: '浏览器自带',
    desc: '不消耗 API 额度，依赖当前浏览器或系统语音服务（部分浏览器不支持）',
    keyHint: '',
  },
];

const isNative = (): boolean => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

const getWebCtor = (): any =>
  (typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;

const useStaticWorker = (): boolean => {
  if (typeof window === 'undefined') return false;
  return isStaticWebDeployment(window.location.protocol, window.location.hostname);
};

/**
 * Check whether a baseUrl explicitly points to an official MiniMax API domain.
 * Prevents accidentally treating a third-party OpenAI/DeepSeek dialogue key as a MiniMax key.
 */
export const isOfficialMiniMaxBaseUrl = (baseUrl?: string | null): boolean => {
  const raw = (baseUrl || '').trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return /(^|\.)(minimaxi\.com|minimax\.io|minimax\.cn|minimax\.chat)$/i.test(parsed.hostname);
  } catch {
    return /(minimaxi\.com|minimax\.io|minimax\.cn|minimax\.chat)/i.test(raw);
  }
};

/**
 * Strictly resolve MiniMax API Key for STT:
 * Only accepts dedicated `minimaxApiKey`, or main `apiKey` when `baseUrl` is an official MiniMax domain.
 */
export const resolveMiniMaxSttApiKey = (apiConfig?: Partial<APIConfig> | null): string => {
  if (!apiConfig) return '';
  const dedicated = normalizeApiKey(apiConfig.minimaxApiKey || '');
  if (dedicated) return dedicated;
  if (isOfficialMiniMaxBaseUrl(apiConfig.baseUrl)) {
    return normalizeApiKey(apiConfig.apiKey || '');
  }
  return '';
};

export const resolveFishAudioSttApiKey = (apiConfig?: Partial<APIConfig> | null): string =>
  normalizeApiKey(apiConfig?.fishAudioApiKey || '');

export const resolveElevenLabsSttApiKey = (apiConfig?: Partial<APIConfig> | null): string =>
  normalizeApiKey(apiConfig?.elevenLabsApiKey || '');

export const isSttProviderConfigured = (
  provider: SttProvider,
  apiConfig?: Partial<APIConfig> | null,
): boolean => {
  if (provider === 'browser') return true;
  if (provider === 'minimax') return Boolean(resolveMiniMaxSttApiKey(apiConfig));
  if (provider === 'fishaudio') return Boolean(resolveFishAudioSttApiKey(apiConfig));
  if (provider === 'elevenlabs') return Boolean(resolveElevenLabsSttApiKey(apiConfig));
  return false;
};

export const getConfiguredApiSttProviders = (
  apiConfig?: Partial<APIConfig> | null,
): Array<'minimax' | 'fishaudio' | 'elevenlabs'> => {
  const providers: Array<'minimax' | 'fishaudio' | 'elevenlabs'> = ['elevenlabs', 'fishaudio', 'minimax'];
  return providers.filter((p) => isSttProviderConfigured(p, apiConfig));
};

export const hasAnyApiSttConfigured = (apiConfig?: Partial<APIConfig> | null): boolean =>
  getConfiguredApiSttProviders(apiConfig).length > 0;

/**
 * Resolve the active STT provider:
 * 1. If user explicitly chose `apiConfig.sttProvider` and its Key is configured (or 'browser'), use it.
 * 2. Otherwise, if the current `ttsProvider` has its STT Key configured, follow `ttsProvider`.
 * 3. Otherwise, pick the first configured API STT provider (`elevenlabs` -> `fishaudio` -> `minimax`).
 * 4. Otherwise, fall back to `'browser'`.
 */
export const resolveSttProvider = (apiConfig?: Partial<APIConfig> | null): SttProvider => {
  const explicit = apiConfig?.sttProvider;
  if (explicit === 'browser') return 'browser';
  if (explicit && isSttProviderConfigured(explicit, apiConfig)) {
    return explicit;
  }

  const tts = apiConfig?.ttsProvider;
  if (tts === 'elevenlabs' || tts === 'fishaudio' || tts === 'minimax') {
    if (isSttProviderConfigured(tts, apiConfig)) {
      return tts;
    }
  }

  const configured = getConfiguredApiSttProviders(apiConfig);
  if (configured.length > 0) return configured[0];

  return 'browser';
};

export const getSttProviderLabel = (provider: SttProvider): string =>
  STT_PROVIDER_OPTIONS.find((o) => o.id === provider)?.shortLabel || provider;

/** Whether browser/system native SpeechRecognition is available. */
export const isBrowserSttSupported = (): boolean => {
  if (isNative()) return true;
  return !!getWebCtor();
};

/** Whether microphone audio capture (`getUserMedia`) is available for API STT. */
export const isAudioRecordingSupported = (): boolean =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === 'function';

/** Whether voice input is usable in the current environment. */
export const isSttSupported = (apiConfig?: Partial<APIConfig> | null): boolean => {
  if (hasAnyApiSttConfigured(apiConfig) && isAudioRecordingSupported()) return true;
  return isBrowserSttSupported() || isAudioRecordingSupported();
};

const friendlyBrowserError = (raw: string, hasPaidConfigured: boolean): string => {
  const suffix = hasPaidConfigured
    ? '可在「通话偏好」或「设置 → 其他 API」切换为已配置的付费语音识别'
    : '可在「设置 → 其他 API」配置 ElevenLabs、鱼声 Fish 或 MiniMax Key 开启高精度语音转文字';
  if (/not-allowed|permission|denied/i.test(raw)) return '麦克风权限被拒绝，请在浏览器或系统设置里放行';
  if (/no-speech/i.test(raw)) return '没听清，再试一次？';
  if (/audio-capture/i.test(raw)) return '找不到可用麦克风';
  if (/network|service-not-allowed/i.test(raw)) return `当前浏览器语音服务不可用，${suffix}`;
  return `语音识别不可用（${raw || 'unknown'}），${suffix}`;
};

/**
 * Downsample mono Float32 PCM samples to targetSampleRate (default 16kHz)
 * and encode as a 16-bit PCM WAV Blob (`audio/wav`).
 */
export const encodeWavFromFloat32 = (
  samples: Float32Array,
  sourceSampleRate: number,
  targetSampleRate = 16000,
): Blob => {
  const srcRate = Math.max(1, Math.floor(sourceSampleRate || targetSampleRate));
  const dstRate = Math.max(1, Math.floor(targetSampleRate));

  let resampled: Float32Array;
  if (srcRate === dstRate || samples.length === 0) {
    resampled = samples;
  } else {
    const ratio = srcRate / dstRate;
    const newLength = Math.max(1, Math.round(samples.length / ratio));
    resampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i += 1) {
      const start = Math.floor(i * ratio);
      const end = Math.min(samples.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
      let sum = 0;
      for (let j = start; j < end; j += 1) {
        sum += samples[j];
      }
      resampled[i] = sum / (end - start);
    }
  }

  const numSamples = resampled.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format = 1
  view.setUint16(22, 1, true);  // Mono = 1 channel
  view.setUint32(24, dstRate, true);
  view.setUint32(28, dstRate * 2, true); // byte rate (sampleRate * blockAlign)
  view.setUint16(32, 2, true);  // block align (1 channel * 2 bytes)
  view.setUint16(34, 16, true); // bits per sample = 16
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i += 1) {
    const clamped = Math.max(-1, Math.min(1, resampled[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

const shouldRetryWithWorker = (res: Response): boolean => {
  if (res.status === 404 || res.status === 405) return true;
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  return contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
};

const postSttMultipart = async (
  localProxyPath: string,
  workerPath: string,
  buildFormData: () => FormData,
  headers: Record<string, string>,
): Promise<Response> => {
  const workerUrl = `${getProxyWorkerUrl()}${workerPath}`;
  if (isNative() || useStaticWorker()) {
    return fetch(workerUrl, {
      method: 'POST',
      headers,
      body: buildFormData(),
    });
  }

  try {
    const res = await fetch(localProxyPath, {
      method: 'POST',
      headers,
      body: buildFormData(),
    });
    if (shouldRetryWithWorker(res)) {
      return fetch(workerUrl, {
        method: 'POST',
        headers,
        body: buildFormData(),
      });
    }
    return res;
  } catch {
    return fetch(workerUrl, {
      method: 'POST',
      headers,
      body: buildFormData(),
    });
  }
};

const extractApiErrorDetail = (rawText: string): string => {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed);
    const msg =
      parsed?.error?.message ||
      parsed?.base_resp?.status_msg ||
      parsed?.detail?.message ||
      (typeof parsed?.detail === 'string' ? parsed.detail : '') ||
      parsed?.message ||
      parsed?.error;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  } catch {
    // plain text
  }
  return trimmed.slice(0, 180);
};

const formatSttHttpError = (providerLabel: string, status: number, rawText: string): string => {
  const detail = extractApiErrorDetail(rawText);
  const lower = detail.toLowerCase();
  if (status === 401 || lower.includes('invalid api key') || lower.includes('unauthorized') || lower.includes('authorized_error')) {
    return `${providerLabel} API Key 无效或未开通语音识别权限，请前往「设置 → 其他 API」检查`;
  }
  if (status === 402 || lower.includes('insufficient_balance') || lower.includes('quota') || lower.includes('credits') || lower.includes('payment')) {
    return `${providerLabel} 账户余额或配额不足`;
  }
  if (status === 403) {
    return `${providerLabel} 拒绝访问，请检查 Key 权限`;
  }
  if (status === 429 || lower.includes('rate_limit') || lower.includes('too many requests')) {
    return `${providerLabel} 请求过于频繁，请稍后再试`;
  }
  return `${providerLabel} 语音转写失败 (HTTP ${status})${detail ? `：${detail}` : ''}`;
};

/**
 * Strip Fish Audio `transcribe-1-pro` speaker turn prefixes such as `<|speaker:0|>`.
 */
export const cleanFishAsrText = (raw: string): string =>
  (raw || '').replace(/<\|speaker:\d+\|>/gi, '').replace(/\s+/g, ' ').trim();

/**
 * Send a recorded WAV blob to the specified paid STT provider and return the transcript.
 */
export async function transcribeAudioWithProvider(
  wavBlob: Blob,
  provider: 'minimax' | 'fishaudio' | 'elevenlabs',
  lang: string,
  apiConfig?: Partial<APIConfig> | null,
): Promise<string> {
  const normalizedLang = (lang || '').trim().toLowerCase();

  if (provider === 'minimax') {
    const apiKey = resolveMiniMaxSttApiKey(apiConfig);
    if (!apiKey) {
      throw new Error('未配置官方 MiniMax API Key，请在「设置 → 其他 API」填写，或切换至 ElevenLabs / 鱼声 Fish');
    }
    const region = normalizeMinimaxRegion(apiConfig?.minimaxRegion || getMinimaxRegion());
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'X-MiniMax-Region': region,
    };
    if (normalizedLang === 'yue') {
      headers['language'] = 'yue';
    }

    const res = await postSttMultipart(
      '/api/minimax/stt',
      `/minimax/stt?region=${encodeURIComponent(region)}`,
      () => {
        const form = new FormData();
        form.append('model', 'asr-1.0');
        form.append('response_format', 'json');
        form.append('file', wavBlob, 'speech.wav');
        return form;
      },
      headers,
    );

    const rawText = await res.text();
    if (!res.ok) {
      throw new Error(formatSttHttpError('MiniMax ASR', res.status, rawText));
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error('MiniMax ASR 返回格式异常');
    }
    if (data?.type === 'error' || data?.error) {
      throw new Error(formatSttHttpError('MiniMax ASR', Number(data?.error?.http_code) || 400, rawText));
    }
    if (data?.base_resp?.status_code && data.base_resp.status_code !== 0) {
      throw new Error(formatSttHttpError('MiniMax ASR', 400, rawText));
    }
    return String(data?.text || '').trim();
  }

  if (provider === 'fishaudio') {
    const apiKey = resolveFishAudioSttApiKey(apiConfig);
    if (!apiKey) {
      throw new Error('未配置鱼声 Fish Audio API Key，请在「设置 → 其他 API」填写');
    }
    const model = 'transcribe-1-pro';
    const res = await postSttMultipart(
      '/api/fishaudio/stt',
      `/fishaudio/stt?model=${encodeURIComponent(model)}`,
      () => {
        const form = new FormData();
        form.append('audio', wavBlob, 'speech.wav');
        form.append('ignore_timestamps', 'true');
        form.append('tag_audio_events', 'false');
        if (normalizedLang === 'yue') {
          form.append('language', 'yue');
        }
        return form;
      },
      {
        Authorization: `Bearer ${apiKey}`,
        model,
      },
    );

    const rawText = await res.text();
    if (!res.ok) {
      throw new Error(formatSttHttpError('鱼声 Fish ASR', res.status, rawText));
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error('鱼声 Fish ASR 返回格式异常');
    }
    return cleanFishAsrText(String(data?.text || ''));
  }

  // provider === 'elevenlabs'
  const apiKey = resolveElevenLabsSttApiKey(apiConfig);
  if (!apiKey) {
    throw new Error('未配置 ElevenLabs API Key，请在「设置 → 其他 API」填写');
  }

  const res = await postSttMultipart(
    '/api/elevenlabs/stt',
    '/elevenlabs/stt',
    () => {
      const form = new FormData();
      form.append('model_id', 'scribe_v2');
      form.append('tag_audio_events', 'false');
      if (normalizedLang === 'yue') {
        form.append('language_code', 'yue');
      }
      form.append('file', wavBlob, 'speech.wav');
      return form;
    },
    {
      'xi-api-key': apiKey,
    },
  );

  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(formatSttHttpError('ElevenLabs Scribe', res.status, rawText));
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error('ElevenLabs Scribe 返回格式异常');
  }
  return String(data?.text || '').trim();
}

const MAX_RECORDING_MS = 60_000;
const MIN_RECORDING_SAMPLES_AT_16K = 3200; // ~0.2s

/**
 * 云端 STT 走 WebView 的 getUserMedia。排查记录：RECORD_AUDIO 已由 speech-recognition 插件
 * 声明、用户在系统设置里也授了、Capacitor 的 BridgeWebChromeClient.onPermissionRequest 也会
 * grant AUDIO_CAPTURE —— 三样都齐，但部分机型 WebView 首次 getUserMedia 仍会秒拒
 * NotAllowedError。根因是那一刻 App 进程并没真正握住 RECORD_AUDIO（系统里显示“已允许”≠
 * 运行时已授予）。这里在录音前用原生插件主动请求一次 RECORD_AUDIO，把权限当场落到进程上，
 * 再交给 getUserMedia。非原生环境（普通浏览器）直接跳过，交给浏览器自身的权限流程。
 */
const ensureNativeMicPermission = async (): Promise<void> => {
  if (!isNative()) return;
  try {
    const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
    let st: string | undefined;
    try { st = (await SpeechRecognition.checkPermissions())?.speechRecognition; } catch { st = undefined; }
    if (st !== 'granted') {
      // 请求本身失败也不拦（个别 ROM 返回非标准状态），继续交给 getUserMedia 实测
      try { await SpeechRecognition.requestPermissions(); } catch { /* noop */ }
    }
  } catch { /* 插件缺失/加载失败都不拦，让 getUserMedia 去实测 */ }
};

const startApiStt = async (
  provider: 'minimax' | 'fishaudio' | 'elevenlabs',
  lang: string,
  apiConfig: Partial<APIConfig> | null | undefined,
  cb: SttCallbacks,
): Promise<SttSession> => {
  if (!isAudioRecordingSupported()) {
    cb.onError?.('当前环境不支持麦克风录音，请检查浏览器权限或改用 HTTPS 访问');
    cb.onEnd?.();
    return { stop: () => {} };
  }

  // 原生 App：录音前先把 RECORD_AUDIO 真正落到进程上（见 ensureNativeMicPermission 注释）
  await ensureNativeMicPermission();

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (e: any) {
    cb.onError?.(friendlyBrowserError(e?.name || e?.message || 'permission-denied', true));
    cb.onEnd?.();
    return { stop: () => {} };
  }

  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    stream.getTracks().forEach((t) => t.stop());
    cb.onError?.('当前浏览器不支持 WebAudio 录音');
    cb.onEnd?.();
    return { stop: () => {} };
  }

  const audioCtx: AudioContext = new AudioCtx();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume().catch(() => {});
  }

  const source = audioCtx.createMediaStreamSource(stream);
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  const recordedChunks: Float32Array[] = [];
  let totalSamples = 0;
  let stopped = false;

  processor.onaudioprocess = (event: AudioProcessingEvent) => {
    if (stopped) return;
    const input = event.inputBuffer.getChannelData(0);
    const copy = new Float32Array(input.length);
    copy.set(input);
    recordedChunks.push(copy);
    totalSamples += copy.length;
  };

  source.connect(processor);
  processor.connect(audioCtx.destination);

  const stopRecordingAndTranscribe = async () => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(autoStopTimer);

    try {
      processor.disconnect();
      source.disconnect();
    } catch { /* ignore */ }
    stream.getTracks().forEach((t) => t.stop());
    const sampleRate = audioCtx.sampleRate || 48000;
    audioCtx.close().catch(() => {});

    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of recordedChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const estimated16kSamples = Math.round((totalSamples / sampleRate) * 16000);
    if (estimated16kSamples < MIN_RECORDING_SAMPLES_AT_16K) {
      cb.onError?.('录音时间太短啦，点一下麦克风开始说话，说完再点一下结束识别');
      cb.onEnd?.();
      return;
    }

    cb.onTranscribing?.(true);
    try {
      const wavBlob = encodeWavFromFloat32(merged, sampleRate, 16000);
      const transcript = await transcribeAudioWithProvider(wavBlob, provider, lang, apiConfig);
      if (transcript) {
        cb.onFinal?.(transcript);
      } else {
        cb.onError?.('没听清刚才那句话，请靠近麦克风再试一次');
      }
    } catch (err: any) {
      cb.onError?.(err?.message || '语音转写失败');
    } finally {
      cb.onTranscribing?.(false);
      cb.onEnd?.();
    }
  };

  const autoStopTimer = window.setTimeout(() => {
    void stopRecordingAndTranscribe();
  }, MAX_RECORDING_MS);

  return {
    stop: () => {
      void stopRecordingAndTranscribe();
    },
  };
};

// No-response watchdog: domestic Android browsers (Via / Quark / UC / Baidu / WeChat X5)
// expose `webkitSpeechRecognition` on window, but the underlying Google speech service is
// unreachable or stripped from the WebView — `start()` silently hangs with zero events.
const SILENT_HANG_WATCHDOG_MS = 7000;

const startWeb = (lang: string, cb: SttCallbacks, hasPaidConfigured: boolean): SttSession => {
  const Ctor = getWebCtor();
  if (!Ctor) {
    const hint = hasPaidConfigured
      ? '当前浏览器不支持自带语音识别，请在「通话偏好」或「设置 → 其他 API」切换为已配置的付费语音转文字'
      : '当前浏览器不支持自带语音识别，可在「设置 → 其他 API」配置 ElevenLabs、鱼声 Fish 或 MiniMax Key 开启高精度语音转文字';
    cb.onError?.(hint);
    cb.onEnd?.();
    return { stop: () => {} };
  }

  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;

  let finalBuf = '';
  let lastEmitted = '';
  let gotAnyResult = false;
  let watchdog: number | null = null;
  const clearWatchdog = () => {
    if (watchdog !== null) { window.clearTimeout(watchdog); watchdog = null; }
  };

  rec.onresult = (e: any) => {
    gotAnyResult = true;
    clearWatchdog();
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const t = r?.[0]?.transcript || '';
      if (r.isFinal) finalBuf += t;
      else interim += t;
    }
    const combined = (finalBuf + interim).trim();
    if (combined) {
      lastEmitted = combined;
      cb.onPartial?.(combined);
    }
  };

  rec.onerror = (e: any) => {
    clearWatchdog();
    if (e?.error === 'aborted') return;
    cb.onError?.(friendlyBrowserError(e?.error || e?.message || '', hasPaidConfigured));
  };

  rec.onend = () => {
    clearWatchdog();
    if (lastEmitted) cb.onFinal?.(lastEmitted);
    cb.onEnd?.();
  };

  try {
    rec.start();
  } catch (e: any) {
    cb.onError?.(friendlyBrowserError(e?.message || 'start-failed', hasPaidConfigured));
    cb.onEnd?.();
    return { stop: () => {} };
  }

  watchdog = window.setTimeout(() => {
    watchdog = null;
    if (gotAnyResult) return;
    try { rec.stop(); } catch { /* ignore */ }
    cb.onError?.(
      hasPaidConfigured
        ? '浏览器自带语音识别无响应，可在「通话偏好」切换为 ElevenLabs / 鱼声 Fish / MiniMax 语音识别'
        : '浏览器自带语音服务无响应，建议在「设置 → 其他 API」配置 ElevenLabs、鱼声 Fish 或 MiniMax Key 使用付费语音转文字'
    );
  }, SILENT_HANG_WATCHDOG_MS);

  return { stop: () => { clearWatchdog(); try { rec.stop(); } catch { /* ignore */ } } };
};

// 系统（native）识别看门狗：开麦后这么久还没收到任何识别信号，多半是这台设备的
// RecognitionService 根本不返回结果（国产 ROM 缺谷歌语音服务的典型症状：start()
// 正常 resolve、麦克风也开着，但永远不推 partialResults、也不报错）。给一次可操作
// 提示，但不打断会话——用户可能只是还没开口。
const STT_NATIVE_WATCHDOG_MS = 9000;

const startNative = async (lang: string, cb: SttCallbacks, hasPaidConfigured: boolean): Promise<SttSession> => {
  const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');

  const perm = await SpeechRecognition.checkPermissions().catch(() => ({ speechRecognition: 'prompt' as const }));
  if (perm.speechRecognition !== 'granted') {
    const req = await SpeechRecognition.requestPermissions();
    if (req.speechRecognition !== 'granted') throw new Error('麦克风权限被拒绝');
  }

  let lastPartial = '';
  let ended = false;
  let gotSignal = false;
  const handle = await SpeechRecognition.addListener('partialResults', (data: any) => {
    const m = data?.matches?.[0];
    if (m) { gotSignal = true; lastPartial = m; cb.onPartial?.(m); }
  });

  const finish = (finalText: string, errMsg?: string) => {
    if (ended) return;
    ended = true;
    handle.remove();
    if (errMsg) cb.onError?.(friendlyBrowserError(errMsg, hasPaidConfigured));
    else if (finalText) cb.onFinal?.(finalText);
    cb.onEnd?.();
  };

  SpeechRecognition.start({ language: lang, partialResults: true, popup: false, maxResults: 1 })
    .then((res: any) => finish((res?.matches?.[0] || lastPartial || '').trim()))
    .catch((e: any) => finish('', e?.message || 'native-error'));

  // 看门狗：一直没收到识别信号就给可操作提示（不打断会话，见常量注释）
  setTimeout(() => {
    if (gotSignal || ended) return;
    cb.onError?.('还没识别到声音。如果点了没反应，多半是这台设备的系统语音识别不可用（常见于缺谷歌语音服务的 ROM）——可在「通话偏好」或「设置 → 其他 API」切换为已配置的付费语音识别。');
  }, STT_NATIVE_WATCHDOG_MS);

  return { stop: () => { SpeechRecognition.stop().catch(() => { /* ignore */ }); } };
};

/**
 * Start a speech-to-text session using the resolved provider (`minimax`, `fishaudio`, `elevenlabs`, or `browser`).
 */
export const startStt = async (
  lang: string,
  cb: SttCallbacks,
  apiConfig?: Partial<APIConfig> | null,
): Promise<SttSession> => {
  const language = lang || 'zh-CN';
  const provider = resolveSttProvider(apiConfig);
  if (provider === 'minimax' || provider === 'fishaudio' || provider === 'elevenlabs') {
    return startApiStt(provider, language, apiConfig, cb);
  }
  const hasPaid = hasAnyApiSttConfigured(apiConfig);
  if (isNative()) return startNative(language, cb, hasPaid);
  return startWeb(language, cb, hasPaid);
};

// ─────────────────────────────────────────────────────────────────────────────
// Fork：通用云端 STT（OpenAI 兼容 /v1/audio/transcriptions）
// 上游走官方三厂商模型；这条是 fork 面试语音练习（JobHuntApp / CallApp sttOverride）的
// 通道——任意兼容端点（SiliconFlow SenseVoice / Groq Whisper / OpenAI Whisper）都行，
// 并额外提供 onLevel（波形）与 onAudioBlob（完整音频给说话状态分析）两个回调。
// ─────────────────────────────────────────────────────────────────────────────

const resolveTranscriptionUrl = (baseUrl: string): string => {
  const b = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!b) return '';
  if (/\/audio\/transcriptions$/i.test(b)) return b;
  if (/\/v\d+$/i.test(b)) return `${b}/audio/transcriptions`;
  return `${b}/v1/audio/transcriptions`;
};

const DEFAULT_CLOUD_STT_BASE = 'https://api.siliconflow.cn/v1';

export const startCloudStt = async (lang: string, cb: SttCallbacks, cfg: SttProviderConfig): Promise<SttSession> => {
  // Base URL 留空 → 默认 SiliconFlow（与设置页文案一致）
  const url = resolveTranscriptionUrl(cfg.baseUrl?.trim() || DEFAULT_CLOUD_STT_BASE);
  if (!cfg.apiKey) throw new Error('先在设置→其他 API 里填云端 STT 的 API Key');
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前环境不支持录音（MediaRecorder 不可用）');
  }

  // 关键修复：录音前先确保原生 RECORD_AUDIO 真正落到进程上，规避“设置里已允许、
  // getUserMedia 仍秒拒 NotAllowed”的机型坑（见 ensureNativeMicPermission 注释）。
  await ensureNativeMicPermission();

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch((err: any) => {
    // 不能把所有失败都说成"权限被拒绝"。按错误名区分，给准确可操作文案；
    // 附 [错误名/平台/安全上下文] 诊断尾巴，别再掩盖真因。
    const name = err?.name || '';
    const secure = typeof window !== 'undefined' && (window as any).isSecureContext === false ? '/insecure' : '';
    const diag = ` [${name || 'Unknown'}${isNative() ? '/native' : '/web'}${secure}]`;
    if (/NotAllowed|Security/i.test(name)) throw new Error('麦克风权限被拒绝，去系统设置里允许一下' + diag);
    if (/NotFound|Overconstrained/i.test(name)) throw new Error('没找到可用麦克风（设备无麦风/被禁用）' + diag);
    if (/NotReadable|AbortError/i.test(name)) throw new Error('麦克风被其它应用占用了，关掉那边再试' + diag);
    throw new Error(`无法开启录音（${name || '未知错误'}）` + diag);
  });

  // ── 实时音量：AnalyserNode 取时域 RMS，~100ms 一次推给 UI 画波形 ──
  let audioCtx: AudioContext | null = null;
  let levelTimer: ReturnType<typeof setInterval> | null = null;
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
      const srcNode = audioCtx!.createMediaStreamSource(stream);
      const analyser = audioCtx!.createAnalyser();
      analyser.fftSize = 512;
      srcNode.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      levelTimer = setInterval(() => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i += 1) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        // RMS 平时说话大概 0.02~0.2，放大到 0..1 好看些
        const level = Math.min(1, Math.sqrt(sum / buf.length) * 4);
        cb.onLevel?.(level);
      }, 100);
    }
  } catch { /* 波形是锦上添花，失败不影响录音 */ }

  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', '']
    .find(m => !m || (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(m))) ?? '';
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

  let stopped = false;
  const releaseMic = () => {
    if (levelTimer) { clearInterval(levelTimer); levelTimer = null; }
    try { audioCtx?.close(); } catch { /* ignore */ }
    audioCtx = null;
    try { stream.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
  };

  recorder.onstop = async () => {
    releaseMic();
    // 录音结束 → 进入「识别中」，UI 据此显示思考态而不是瞎等
    cb.onRecognizing?.();
    try {
      const blob = new Blob(chunks, { type: mime || 'audio/webm' });
      if (blob.size < 1024) {
        cb.onError?.('没录到声音，再试一次？');
        cb.onEnd?.();
        return;
      }
      // 把完整音频交给调用方（面试场景后台分析说话状态）；不影响下方 STT 转写
      cb.onAudioBlob?.(blob);
      const fd = new FormData();
      const ext = /mp4/.test(mime) ? 'm4a' : 'webm';
      fd.append('file', blob, `voice.${ext}`);
      fd.append('model', cfg.model?.trim() || 'FunAudioLLM/SenseVoiceSmall');
      const resp = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
        body: fd,
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw new Error(`识别接口返回 ${resp.status}：${body.slice(0, 160) || '无详情'}`);
      }
      const data = await resp.json().catch(() => ({}));
      const text = typeof data?.text === 'string' ? data.text.trim() : '';
      if (text) cb.onFinal?.(text);
      else cb.onError?.('没有识别到内容，再说一次？');
    } catch (e: any) {
      const raw = (e && (e.message || String(e))) || '识别失败';
      cb.onError?.(typeof raw === 'string' ? raw : String(raw));
    }
    cb.onEnd?.();
  };

  // timeslice：定期落盘，录很长也不丢数据
  recorder.start(250);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      try { recorder.stop(); } catch { releaseMic(); cb.onEnd?.(); }
    },
  };
};
