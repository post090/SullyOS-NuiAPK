export const VOICE_LANGUAGE_OPTIONS = [
  { value: '', label: '默认' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ru', label: 'Русский' },
] as const;

export const voiceLanguageLabel = (value?: string): string => (
  VOICE_LANGUAGE_OPTIONS.find(option => option.value === (value || ''))?.label
  || value
  || '默认'
);
