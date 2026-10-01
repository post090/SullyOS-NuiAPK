import React from 'react';
import roomArt from '../../assets/sar-club-room.png';
import './sar-club-room.css';

/** Match the room's full viewport, independently of the portrait stage and dialogue box. */
export function SARDialogueBackdrop() {
    return <div className="srf-room-backdrop" aria-hidden="true">
        <div className="srf-room-viewport"><img src={roomArt} alt="" draggable={false}/></div>
    </div>;
}
