// One in-memory navigation intent, consumed after the Appearance channel mounts.
let receiveRequested = false;
export const requestBeautyReceive = () => { receiveRequested = true; };
export const hasBeautyReceiveRequest = () => receiveRequested;
export const clearBeautyReceiveRequest = () => { receiveRequested = false; };

let libraryCategory:'schedule'|'journal'|null=null;
export const requestBeautyLibrary=(category:'schedule'|'journal')=>{libraryCategory=category;};
export const hasBeautyLibraryRequest=()=>!!libraryCategory;
export const readBeautyLibraryRequest=()=>libraryCategory;
export const clearBeautyLibraryRequest=()=>{libraryCategory=null;};
