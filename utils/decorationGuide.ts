export const DECORATION_UPDATE_KEY='sullyos_chat_wardrobe_update_v2_seen';
export const DECORATION_GUIDE_KEY='sullyos_chat_wardrobe_guide_v2_done';
let finished=false;
export function needsDecorationGuide(){try{return !finished&&!localStorage.getItem(DECORATION_GUIDE_KEY);}catch{return !finished;}}
export function finishDecorationGuide(){finished=true;try{localStorage.setItem(DECORATION_GUIDE_KEY,'1');}catch{/* Session fallback. */}}
