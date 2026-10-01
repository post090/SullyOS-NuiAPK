import React from 'react';
import type {Message} from '../../types';
import './ChatCardSurface.css';

export function isChatCard(type: Message['type']) {
  return type.endsWith('_card') || ['transfer', 'chat_forward', 'collaboration_file'].includes(type);
}

/** One stable styling boundary for cards, without changing their actions or payloads. */
export function ChatCardSurface({message, children}: {message: Message; children: React.ReactNode}) {
  if (!isChatCard(message.type)) return <>{children}</>;
  const meta = message.metadata || {};
  let score=meta.scoreCard;
  if(message.type==='score_card'&&!score){try{score=JSON.parse(message.content);}catch{/* Legacy malformed cards keep their fallback renderer. */}}
  const variant = score?.type || meta.phoneCard?.kind || meta.mcdCardKind || meta.luckinCardKind || (meta.sarCabinetNote?'sar_cabinet':meta.room) || meta.receipt || meta.status || '';
  return <div className="sully-chat-card" data-card-kind={message.type} data-card-variant={variant} data-role={message.role}>
    <div className="sully-chat-card-surface"><div className="sully-chat-card-content">{children}</div></div>
  </div>;
}
