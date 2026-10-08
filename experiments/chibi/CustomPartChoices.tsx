import React from 'react';
import type {CustomCreatorPart} from '../../types';

export function CustomPartChoices({items, categories, selected, onSelect, leading}: {
 leading?:React.ReactNode;
 items: CustomCreatorPart[]; categories: string[];
 selected: Record<string, string | string[] | null>;
 onSelect: (part: CustomCreatorPart) => void;
}) {
 const choices=items.filter(item=>categories.includes(item.categoryKey));
 if(!choices.length&&!leading)return null;
 return <section aria-label="形象款式"><div className="custom-part-grid">{leading}{choices.map(part=>{
  const value=selected[part.categoryKey];
  return <button key={part.id} aria-label={part.name} aria-pressed={Array.isArray(value)?value.includes(part.id):value===part.id} onClick={()=>onSelect(part)}>
   <img src={part.src} alt=""/><span>{part.name}</span>
  </button>;
 })}</div></section>;
}
