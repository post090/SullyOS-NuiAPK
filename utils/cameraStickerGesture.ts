export interface StickerTransform { x: number; y: number; size: number; angle: number }
export interface CameraPoint { x: number; y: number }
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const stickerAngle = (angle: number) => ((angle + 180) % 360 + 360) % 360 - 180;

/** Points are in photo pixels, after removing the frame's paper margins. */
export class CameraStickerGesture {
    private points = new Map<number, CameraPoint>();
    private baseline: { transform: StickerTransform; points: CameraPoint[] };
    current: StickerTransform;
    constructor(readonly id: number, transform: StickerTransform, private width: number, private height: number, private maxSize: number) {
        this.current = {...transform}; this.baseline = {transform:this.current,points:[]};
    }
    get count() {return this.points.size;}
    has(pointerId: number) {return this.points.has(pointerId);}
    private rebase() {this.baseline = {transform:{...this.current},points:[...this.points.values()]};}
    add(pointerId: number, point: CameraPoint) {
        if (this.points.size >= 2 || this.points.has(pointerId)) return false;
        this.points.set(pointerId,point); this.rebase(); return true;
    }
    move(pointerId: number, point: CameraPoint): StickerTransform | null {
        if (!this.points.has(pointerId)) return null;
        this.points.set(pointerId,point);
        const before=this.baseline.points, after=[...this.points.values()], original=this.baseline.transform;
        let x=original.x*this.width, y=original.y*this.height, size=original.size, angle=original.angle;
        if (after.length === 1) {x += after[0].x-before[0].x; y += after[0].y-before[0].y;}
        else {
            const a={x:before[1].x-before[0].x,y:before[1].y-before[0].y};
            const b={x:after[1].x-after[0].x,y:after[1].y-after[0].y};
            const distance=Math.hypot(a.x,a.y), currentDistance=Math.hypot(b.x,b.y);
            // Coincident fingers must not introduce an infinite scale or random rotation.
            if (distance < 2 || currentDistance < 2) {this.rebase(); return this.current;}
            size=clamp(original.size*currentDistance/distance,0.08,this.maxSize);
            const ratio=size/original.size;
            const turn=stickerAngle((Math.atan2(b.y,b.x)-Math.atan2(a.y,a.x))*180/Math.PI)*Math.PI/180;
            const dx=x-(before[0].x+before[1].x)/2, dy=y-(before[0].y+before[1].y)/2;
            x=(after[0].x+after[1].x)/2 + ratio*(dx*Math.cos(turn)-dy*Math.sin(turn));
            y=(after[0].y+after[1].y)/2 + ratio*(dx*Math.sin(turn)+dy*Math.cos(turn));
            angle=stickerAngle(original.angle+turn*180/Math.PI);
        }
        this.current={x:clamp(x/this.width,0.05,0.95),y:clamp(y/this.height,0.05,0.95),size,angle};
        return this.current;
    }
    remove(pointerId: number) {
        if (!this.points.delete(pointerId)) return false;
        // Continue dragging with the remaining finger without jumping back.
        this.rebase(); return true;
    }
}
