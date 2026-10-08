import type {CSSProperties} from 'react';

export const HOMELY_PALETTES = [
  {id:'apricot', name:'奶油杏橙', accent:'#e5ad82', active:'#b77c54', soft:'#f4e1d1', paper:'#faf3e7', surface:'#fffaf2', ink:'#695344', buttonInk:'#4c3b30', muted:'#7d6759', border:'#e4d4bf', phone:'#ebc2a1'},
  {id:'blue', name:'云朵雾蓝', accent:'#a8c7df', active:'#647f9b', soft:'#dde9f1', paper:'#f0f4f7', surface:'#f9fcff', ink:'#42586a', buttonInk:'#2f4252', muted:'#5c7180', border:'#ccdbe6', phone:'#bed5e6'},
  {id:'rose', name:'牛奶藕粉', accent:'#dfb1bd', active:'#a97485', soft:'#f1dfe5', paper:'#f9f0f1', surface:'#fff9fa', ink:'#70505b', buttonInk:'#503842', muted:'#80636f', border:'#e6d0d8', phone:'#e9c4ce'},
  {id:'lilac', name:'轻雾淡紫', accent:'#c4b6df', active:'#8b78aa', soft:'#e8e1f3', paper:'#f4f1f8', surface:'#fcfaff', ink:'#5c526e', buttonInk:'#433950', muted:'#71647f', border:'#dcd3e8', phone:'#d5c9e8'},
  {id:'oat', name:'燕麦拿铁', accent:'#cdbb9f', active:'#938169', soft:'#eae2d5', paper:'#f5f1e9', surface:'#fffcf6', ink:'#61584a', buttonInk:'#453d32', muted:'#726859', border:'#ddd3c2', phone:'#dfd0b8'},
] as const;

export type HomelyPaletteId = typeof HOMELY_PALETTES[number]['id'];
export function homelyPalette(id?:string) {
  return HOMELY_PALETTES.find(p => p.id === id) ?? HOMELY_PALETTES[0];
}
export function homelyPaletteStyle(id?:string):CSSProperties {
  const p = homelyPalette(id);
  return {
    '--homely-accent':p.accent, '--homely-accent-active':p.active,
    '--homely-paper':p.paper, '--homely-surface':p.surface,
    '--homely-ink':p.ink, '--homely-muted':p.muted, '--homely-button-ink':p.buttonInk, '--homely-border':p.border,
    '--animal-primary-color':p.accent, '--animal-primary-color-active':p.active,
    '--animal-primary-color-bg':p.soft, '--animal-primary-color-hover':p.active,
    '--animal-bg-color':p.surface, '--animal-text-color':p.ink,
    '--animal-text-color-secondary':p.muted, '--animal-border-color':p.border,
    '--island-paper':p.paper, '--home-phone-case':p.phone, '--home-phone-ink':p.active,
  } as CSSProperties;
}
