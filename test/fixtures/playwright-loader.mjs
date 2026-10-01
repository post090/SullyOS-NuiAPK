// Allows the official skill client to use the host's bundled Playwright without npm installs.
import { pathToFileURL } from 'node:url';
export async function resolve(specifier,context,nextResolve){
    if(specifier==='playwright'&&process.env.FISHING_PLAYWRIGHT_MODULE)return {url:new URL('./playwright-host.mjs',import.meta.url).href,shortCircuit:true};
    return nextResolve(specifier,context);
}
