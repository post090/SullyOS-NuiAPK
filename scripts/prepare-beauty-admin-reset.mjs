import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

// The grant must be installed by a Cloudflare operator. Never handles passwords.
const token = randomBytes(32).toString('hex');
const hash = createHash('sha256').update(token).digest('hex');
const expires = Date.now() + 30 * 60 * 1000;
mkdirSync('output/admin-reset', { recursive: true });
writeFileSync('output/admin-reset/grant.sql', `DELETE FROM limits WHERE key GLOB 'admin-reset:*' AND length(key)=76;\nINSERT INTO limits(key,value,expires_at) SELECT 'admin-reset:${hash}',1,${expires} WHERE EXISTS(SELECT 1 FROM authors WHERE role='admin');\n`);
writeFileSync('output/admin-reset/link.json', JSON.stringify({ url: `https://beauty.friedsully.com/admin/#reset=${token}`, expiresAt: new Date(expires).toISOString() }));
console.log('Prepared a 30-minute grant and local reset link in output/admin-reset. No password changed.');
