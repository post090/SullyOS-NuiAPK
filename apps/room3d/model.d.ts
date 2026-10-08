import type {Home3DItem,Home3DRoom,Home3DState} from './types';
export interface SupportSurface {shape:string;radius?:number;height:number;width?:number;depth?:number;center?:[number,number]}
export function supportSurfaces(asset:HomeAsset|undefined):SupportSurface[];
export interface GamingStation {id?:string;label?:string;position:number[];rotation:number;hands:number[][];beats?:{position:number[];targets:number[][];keys:string[]}[]}
export interface HomeAsset {id:string;name:string;surface:string;size:number[];default:number[];boxes:number[][];url?:string;revision?:string;paintMaterials?:string[];colorParts?:{material:string;label:string;color:string}[];daylight?:boolean;chairSlots?:{id:string;position:number[];rotation:number}[];collection?:string;category?:string;dining?:boolean;appliance?:'fridge';activity?:({kind:string}&(GamingStation|{stations:GamingStation[]}));contact?:{width:number;depth:number;center?:[number,number]};holdable?:boolean;waterable?:boolean;beds?:{id:string;label:string;position:number[];rotation?:number}[];seats?:{id:string;label:string;position:[number,number,number];rotation?:number}[];building?:boolean;support?:SupportSurface&{areas?:SupportSurface[]}}
export const TYPE_LABELS:Record<string,string>;
export function furnitureType(asset:HomeAsset):string;
export function isWaterablePlant(asset:HomeAsset|undefined):boolean;
export function snapToFurniture(item:Home3DItem,room:Home3DRoom,catalog:HomeAsset[]):Home3DItem;
export function snapToSupport(item:Home3DItem,room:Home3DRoom,catalog:HomeAsset[]):Home3DItem;
export function moveFurniture(room:Home3DRoom,id:string,patch:Partial<Home3DItem>,catalog:HomeAsset[]):void;
export function previewFurniture(room:Home3DRoom,id:string,patch:Partial<Home3DItem>):Home3DRoom;
export const PALETTE:string[];
export const STEP:number;
export const DIRECTIONS:Record<string,number[]>;
export function clone<T>(value:T):T;
export function uid():string;
export function createHome(catalog:HomeAsset[]):Home3DState;
export function validateHome(raw:unknown,catalog:HomeAsset[]):Home3DState;
export function addRoom(home:Home3DState,direction:string):Home3DRoom;
export function placementError(item:Home3DItem,room:Home3DRoom,catalog:HomeAsset[]):string;
export function findPlace(asset:HomeAsset,room:Home3DRoom,catalog:HomeAsset[],itemId?:string,length?:number):Home3DItem;

export function findResidentSpot(room:Home3DState['rooms'][number],catalog:any[]):[number,number,number]|null;
