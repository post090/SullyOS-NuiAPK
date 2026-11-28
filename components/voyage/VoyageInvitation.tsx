import React, { type ReactNode } from 'react';
import { ArrowRight, Heart, PaperPlaneTilt } from '@phosphor-icons/react';
import { invitationBody, invitationTitle, type InvitationOccasion } from '../../utils/voyage/letter';
import './paperPalette.css';
import './VoyageInvitation.css';

function InvitationHeading({ occasion, recipient }: { occasion: InvitationOccasion; recipient?: string }) {
    const Heading = recipient === undefined ? 'strong' : 'h2';
    return <Heading className="voyage-invite-heading">
        <span className="voyage-invite-heading-text">
            {recipient !== undefined && <small className="voyage-invite-to">给{recipient}</small>}
            {occasion === 'birthday' && <span className="voyage-invite-script" lang="en">Happy Birthday</span>}
            <span className="voyage-invite-title">{invitationTitle(occasion)}</span>
        </span>
        <span className="voyage-invite-sticker" aria-hidden="true"/>
    </Heading>;
}

export function VoyageInvitationCard({ occasion, content, disabled, onOpen }: {
    occasion: InvitationOccasion; content: string; disabled: boolean; onOpen: () => void;
}) {
    const text = content.replace(/^\[旅迹 (?:· )?[^\]]+\]\s*/, '');
    const notePrefix = invitationBody + '\n\n';
    const note = text.startsWith(notePrefix) ? text.slice(notePrefix.length) : '';
    const Mark = occasion === 'birthday' ? Heart : PaperPlaneTilt;
    const bodyId = React.useId();
    return <button type="button" className="sully-chat-card-face voyage-invite-sheet voyage-invite-message"
        data-occasion={occasion} disabled={disabled} onClick={onOpen}
        aria-label={'查看' + invitationTitle(occasion)} aria-describedby={bodyId}>
        <span className="voyage-invite-panel">
            <InvitationHeading occasion={occasion}/>
            <span className="voyage-invite-body" id={bodyId}>
                <span>{note ? invitationBody : text}</span>
                {note && <span className="voyage-invite-note">{note}</span>}
            </span>
        </span>
        <span className="voyage-invite-stub">
            <span className="voyage-invite-stub-mark" aria-hidden="true"><Mark size={17} weight="duotone"/></span>
            <span>查看邀请</span><ArrowRight size={16} aria-hidden="true"/>
        </span>
    </button>;
}

export function VoyageInvitationPaper({ occasion, recipient, children, footer }: {
    occasion: InvitationOccasion; recipient: string; children: ReactNode; footer: ReactNode;
}) {
    return <section className="voyage-invite-sheet voyage-invite-letter" data-occasion={occasion}>
        <div className="voyage-invite-panel">
            <InvitationHeading occasion={occasion} recipient={recipient}/>
            {children}
        </div>
        <div className="voyage-invite-stub">{footer}</div>
    </section>;
}
