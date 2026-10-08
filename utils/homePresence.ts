import type {CharacterProfile,DailySchedule} from '../types';
import {getCurrentScheduleSlotIndex,getScheduleDateKey} from './scheduleTime';
import {parseHomePosition} from './homeSchedule';
export function homePresence(schedule:DailySchedule|null,char:CharacterProfile,at=new Date()){
 if(!schedule||schedule.date!==getScheduleDateKey(char,at))return undefined;
 const slot=schedule.slots[getCurrentScheduleSlotIndex(schedule.slots,char,at)];
 return slot?parseHomePosition(slot.homePosition,char):undefined;
}
