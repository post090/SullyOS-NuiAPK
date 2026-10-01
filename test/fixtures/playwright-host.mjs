import { pathToFileURL } from 'node:url';
const runtime=await import(pathToFileURL(process.env.FISHING_PLAYWRIGHT_MODULE));
export const chromium={...runtime.chromium,launch:(options)=>runtime.chromium.launch({...options,...(process.env.FISHING_BROWSER_CHANNEL?{channel:process.env.FISHING_BROWSER_CHANNEL}:{})})};
