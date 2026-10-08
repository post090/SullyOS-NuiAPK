// The audition is closed. Rebuild only the reviewed 39-source catalog.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import './finalize-motion-selection.mjs';
const catalog=JSON.parse(fs.readFileSync('output/social-motion-intake/catalog.json'));
const manifest=JSON.parse(fs.readFileSync('public/room3d/motions/selected/manifest.json'));
for(const e of catalog.entries){const expected=manifest.entries.find(m=>m.id===e.id);for(const [i,url] of e.files.entries()){const file=decodeURIComponent(url.startsWith('/room3d/')?'public'+url:url.slice(1));if(createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==expected.hashes[i])throw Error('Source changed: '+e.id);}}
console.log('Verified 39 selected motions and paired source hashes.');
