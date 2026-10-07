import {dataUrlToBlob, getBlobForRef, putImageBlobDeduped, resolveRefToDataUrl} from './blobRef';

// Scan once, including large data URLs. Avoid selector/URL regex backtracking on
// multi-megabyte images, and leave comments and CSS string literals untouched.
function urls(css: string): Array<{start: number; end: number; value: string}> {
    const found: Array<{start: number; end: number; value: string}> = [];
    const quotedEnd = (start: number) => {
        const quote = css[start]; let i = start + 1;
        for (; i < css.length; i++) {
            if (css[i] === '\\') i++;
            else if (css[i] === quote) return i;
        }
        return css.length;
    };
    for (let i = 0; i < css.length; i++) {
        // Escaped punctuation in generated selectors (e.g. content-\[\'\'\])
        // is not the start of a string/comment. Losing quote alignment here
        // would skip later image URLs in the combined preview stylesheet.
        if (css[i] === '\\') i++;
        else if (css[i] === '/' && css[i + 1] === '*') {
            const end = css.indexOf('*/', i + 2); i = end < 0 ? css.length : end + 1;
        } else if (css[i] === '"' || css[i] === "'") i = quotedEnd(i);
        else if (css.slice(i, i + 4).toLowerCase() === 'url(' && (i === 0 || !/[\w-]/.test(css[i - 1]))) {
            let start = i + 4; while (/\s/.test(css[start] || '') && start < css.length) start++;
            let end: number; let close: number;
            if (css[start] === '"' || css[start] === "'") {
                end = quotedEnd(start); start++; close = end + 1;
                while (close < css.length && /\s/.test(css[close])) close++;
            } else {
                close = start;
                while (close < css.length && css[close] !== ')') {if (css[close] === '\\') close++; close++;}
                end = close; while (end > start && /\s/.test(css[end - 1])) end--;
            }
            if (css[close] === ')') found.push({start, end, value: css.slice(start, end)});
            i = close;
        }
    }
    return found;
}

async function mapUrls(css: string, transform: (value: string) => Promise<string>): Promise<string> {
    const cache = new Map<string, string>(); const chunks: string[] = []; let cursor = 0;
    for (const url of urls(css)) {
        let value = cache.get(url.value);
        if (value === undefined) {value = await transform(url.value); cache.set(url.value, value);}
        chunks.push(css.slice(cursor, url.start), value); cursor = url.end;
    }
    chunks.push(css.slice(cursor)); return chunks.join('');
}

/** Only image URLs in primary decoration CSS are localized. Original bytes survive. */
export function localizeCssImages(css: string): Promise<string> {
    if (!/data:image\//i.test(css)) return Promise.resolve(css);
    return mapUrls(css, async value => /^data:image\/[\w.+-]+[;,]/i.test(value)
        ? (await putImageBlobDeduped(dataUrlToBlob(value))).token : value);
}

/** Portable copies keep the author's URL quoting/formatting (and content identity). */
export function portableCssImages(css: string): Promise<string> {
    if (!css.includes('blobref:')) return Promise.resolve(css);
    return mapUrls(css, async value => {
        if (!value.startsWith('blobref:')) return value;
        const image = await resolveRefToDataUrl(value);
        if (!image || image.startsWith('blobref:')) throw Error('部分图片素材已丢失，请重新上传后导出');
        return image;
    });
}

/** Each mounted consumer owns its URLs; late/cancelled loads must also dispose. */
export async function resolveCssImageUrls(css: string, allowMissing = false): Promise<{css: string; dispose: () => void}> {
    if (!css.includes('blobref:')) return {css, dispose: () => {}};
    const owned: string[] = [];
    const dispose = () => {for (const url of owned.splice(0)) URL.revokeObjectURL(url);};
    try {
        const resolved = await mapUrls(css, async value => {
            if (!value.startsWith('blobref:')) return value;
            const blob = await getBlobForRef(value);
            if (!blob) {
                if (allowMissing) return '';
                throw Error('部分图片素材已丢失，请重新上传');
            }
            const url = URL.createObjectURL(blob); owned.push(url); return url;
        });
        return {css: resolved, dispose};
    } catch (error) {dispose(); throw error;}
}
