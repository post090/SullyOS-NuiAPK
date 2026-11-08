import { existsSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';

// Windows PATH may expose Git's cmd directory without its Bash executable.
// Resolve the Bash shipped beside Git rather than accidentally invoking WSL.
export function testBash(): string {
    if (process.platform !== 'win32') return 'bash';
    for (const entry of (process.env.PATH || '').split(delimiter)) {
        if (!existsSync(resolve(entry, 'git.exe'))) continue;
        const bash = resolve(entry, '..', 'bin', 'bash.exe');
        if (existsSync(bash)) return bash;
    }
    throw new Error('These shell-script regressions require Git for Windows Bash on PATH');
}
