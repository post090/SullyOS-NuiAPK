// Room units: shorten the gas lift above the wheel hub, translate the upper chair.
export const CHAIR_SEAT_DROP=.20;
export function loweredChairY(y,previousDrop=0){
 const original=previousDrop&&y>.20?(y>=.55-previousDrop?y+previousDrop:.20+(y-.20)*.35/(.35-previousDrop)):y;
 return original-CHAIR_SEAT_DROP*Math.max(0,Math.min(1,(original-.20)/.35));
}
export function lowerChairGeometry(g,previousDrop=0){const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,loweredChairY(p.getY(i),previousDrop));p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();}
