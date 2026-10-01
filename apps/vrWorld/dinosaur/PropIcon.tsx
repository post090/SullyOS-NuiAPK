import React from 'react';
import type { GardenPropKind } from '../../../utils/vrWorld/dinosaurTypes';
export function PropIcon({kind}:{kind:GardenPropKind}) {
  return <svg className="clay-prop-icon" viewBox="0 0 88 66" aria-hidden="true" stroke="#887f68" strokeWidth="1.3" strokeLinejoin="round">
    <ellipse cx="44" cy="55" rx="31" ry="7" fill="#d9dfc8" stroke="none"/>
    {kind==='picnic'?<><path d="m12 43 43-13 24 19-43 13Z" fill="#dbb49b"/><path d="m23 40 24 19m-9-23 24 19M20 50l43-13M29 56l43-13" stroke="#fff0d6" strokeWidth="3"/><ellipse cx="51" cy="43" rx="12" ry="6" fill="#fff7de"/><ellipse cx="49" cy="40" rx="7" ry="5" fill="#d4aa70"/><path d="m46 39 2 1m3-3 1 1m0 5 2-1"/></>:
    kind==='puddle'?<><ellipse cx="43" cy="45" rx="31" ry="13" fill="#93c9cb"/><path d="M25 42q10-5 18-1m-9 9q15 4 26-3" stroke="#e7f5e0" strokeWidth="2"/><path d="M54 13q-13 16-3 17 10-1 3-17Z" fill="#a6d5d2"/></>:
    kind==='flowers'?<>{[25,44,63].map((x,i)=><g key={x}><path d={`M${x} 53v-${24+i%2*9}`} stroke="#819d72" strokeWidth="3"/><path d={`M${x} 46q-12-12-12-2 6 5 12 2`} fill="#a3b884"/><circle cx={x} cy={29-i%2*9} r="9" fill={i%2?'#efd298':'#e3b7b2'}/><circle cx={x} cy={29-i%2*9} r="3" fill="#d1ad67" stroke="none"/></g>)}</>:
    kind==='tent'?<><path d="M13 52 38 12l36 10 9 32-41 7Z" fill="#ddbf95"/><path d="m13 52 25-40 4 49Z" fill="#f1ddad"/><path d="m24 52 12-23 3 27Z" fill="#7c8673"/><path d="m38 12 36 10" strokeWidth="3"/></>:
    kind==='stump'?<><path d="M25 29v24q18 12 38 0V29" fill="#af8f6c"/><ellipse cx="44" cy="29" rx="19" ry="9" fill="#e7cfa4"/><ellipse cx="44" cy="29" rx="11" ry="5" fill="none"/><path d="M32 39v12m21-13v15"/></>:
    kind==='tree'?<><path d="m40 55 2-29h7l3 26" fill="#b7956e"/><path d="M22 39C6 24 30 3 41 13c15-17 39 9 26 20 4 18-35 19-45 6Z" fill="#99b184"/></>:
    kind==='rock'?<path d="m14 49 10-23 23-9 22 16 7 18-27 6Z" fill="#b4bdab"/>:
    kind==='fence'?<><path d="M19 55V21l4-5 4 5v33m35 0V21l4-5 4 5v34" fill="#d8ba91"/><path d="M17 29h57v6H17Zm0 16h57v6H17Z" fill="#e4cba5"/></>:
    kind==='sign'?<><path d="M41 55V17h6v38" fill="#b89870"/><path d="M17 16h48l9 9-9 9H17Z" fill="#e6d2a3"/><path d="M29 25h28m-6-4 6 4-6 4" stroke="#869c7c" strokeWidth="2"/></>:
    kind==='house'?<><path d="M21 29h45v25H21Z" fill="#e5d4ae"/><path d="m15 29 28-23 30 23Z" fill="#bd9690"/><path d="M39 54V37h13v17" fill="#92a795"/><path d="M26 35h8v8h-8Z" fill="#bacdc5"/></>:
    <><path d="m12 54 23-37h20l23 37Z" fill="#b39d92"/><ellipse cx="45" cy="18" rx="11" ry="5" fill="#dba27e"/><path d="m45 23 3 13 9 4 3 12" stroke="#edbd8c" strokeWidth="5"/><circle cx="43" cy="7" r="4" fill="#d5c8b2"/></>}
  </svg>;
}
