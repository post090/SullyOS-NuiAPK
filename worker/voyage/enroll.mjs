import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const output = process.argv[2];
if (!output) throw new Error('请指定一个新的私有目录保存配对文件。');
const folder = resolve(output);
// A new directory per account prevents a second run from replacing a working pair.
await mkdir(folder, { mode: 0o700 });
const device = randomBytes(32).toString('base64url');
const consent = randomBytes(32).toString('base64url');
const hash = (code) => createHash('sha256').update(code).digest('hex');
const sql = `INSERT INTO accounts(id, device_hash, consent_hash) VALUES ('${randomUUID()}','${hash(device)}','${hash(consent)}');\n`;
for (const [name, content] of [
  ['device-pairing.txt', device],
  ['dot-pairing.txt', consent],
  ['enroll.sql', sql],
]) {
  await writeFile(join(folder, name), content, { flag: 'wx', mode: 0o600 });
}
console.log('已生成设备配对码、Dot 配对码和 enroll.sql。');
