type DialogueNode = { lines: ReadonlyArray<{ speaker: string }>; next?: string; choices?: ReadonlyArray<{ next: string }> };

/** Keep an exchange together, then look six lines ahead at a branch boundary. */
export function keepDialogueGuest(nodes: Record<string, DialogueNode>, nodeId: string, lineIndex: number, lead: 'caian' | 'aiven', guestHasSpoken: boolean): boolean {
    const guest=lead==='caian'?'aiven':'caian',node=nodes[nodeId];
    if(!node)return false;
    // Once the guest speaks, let them stay for this entire beat, including the reaction.
    if(node.lines.slice(0,lineIndex+1).some(line=>line.speaker===guest))return true;
    if(!guestHasSpoken)return false;
    const upcoming=(id:string,start:number,budget:number,seen:Set<string>):boolean=>{
        const current=nodes[id];
        if(!current||seen.has(id)||budget<=0)return false;
        const lines=current.lines.slice(start,start+budget);
        if(lines.some(line=>line.speaker===guest))return true;
        const remaining=budget-(current.lines.length-start);
        const visited=new Set(seen).add(id);
        return remaining>0&&[current.next,...(current.choices||[]).map(choice=>choice.next)]
            .some(next=>!!next&&upcoming(next,0,remaining,visited));
    };
    return upcoming(nodeId,0,6,new Set());
}
