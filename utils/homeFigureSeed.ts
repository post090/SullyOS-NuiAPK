/** Deterministic starting point; never borrow another character's creator draft. */
export function homeFigureSeed(value: any, isSully: boolean) {
 const base = {skin:'skin_01',eyes:'eyes_01',mouth:'mouth_01',fronthair:'fronthair_01',earhair:'earhair_01',back1:'back1_01',back2:null,outfit:'outfit_01',outer:null,facemark:[],decor:[]};
 const selected = {...base,...value?.selected};
 if (!value && isSully) Object.assign(selected,{fronthair:'fronthair_99',earhair:'earhair_99',back1:'back1_99',back2:'back2_99',eyes:'eyes_99'});
 if (!isSully && selected.eyes === 'eyes_99') selected.eyes = 'eyes_01';
 if (!isSully && selected.mouth === 'mouth_99') selected.mouth = 'mouth_01';
 return {...value,selected};
}
