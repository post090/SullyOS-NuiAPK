import React,{useEffect,useRef} from 'react';

/** Choices float over the stage, so dialogue length never moves the cast. */
export function SARDialogueChoices({children}:{children:React.ReactNode}){
    const list=useRef<HTMLDivElement>(null);
    useEffect(()=>{list.current?.querySelector('button')?.focus({preventScroll:true});},[]);
    return <div className="sar-dialogue-choices"><div ref={list} className="sar-dialogue-choices__list" role="group" aria-label="选择回应">{children}</div></div>;
}
