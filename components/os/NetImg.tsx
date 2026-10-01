import React, { useMemo, useState, useEffect } from 'react';
import { externalImageMirrors } from '../../utils/assetUrl';
import { useBlobRefUrl } from '../../utils/blobRef';

/**
 * <img>，但专治「用户自己图床的外链」裂图：原链失败自动切公共图片代理镜像
 * （wsrv.nl / weserv / Photon，见 utils/assetUrl.ts externalImageMirrors）。
 * 典型场景：表情包挂在 catbox.moe 上，大陆直连必裂，走镜像就能救回来。
 *
 * 与 CdnImg 的分工：CdnImg 管自家 GitHub 素材仓库的 CDN 链，
 * NetImg 管任意外部图床链接。blobref 令牌先按 TokenImg 同一套规则解析成 objectURL，
 * data:/blob: 等本地形态原样透传，零开销——所以表情包这类「可能是令牌、也可能是外链」
 * 的值直接交给它就行，不用再套一层 TokenImg。
 *
 * 小心机：某个图床 host 一旦裂过，记进会话级死亡名单，同 host 的后续图片
 * 直接从镜像起跳——不然一面板 30 个 catbox 表情，每个都要陪原链等一次超时。
 */
const deadHosts = new Set<string>();

const hostOf = (url: string): string | null => {
    try { return new URL(url).host; } catch { return null; }
};

type Props = { src?: string | null } & Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'>;

const NetImg: React.FC<Props> = ({ src, onError, ...rest }) => {
    const resolved = useBlobRefUrl(src ?? undefined) || '';
    const chain = useMemo(() => (resolved ? externalImageMirrors(resolved) : []), [resolved]);
    const initialIdx = () => {
        const h = hostOf(resolved);
        return chain.length > 1 && h && deadHosts.has(h) ? 1 : 0;
    };
    const [idx, setIdx] = useState(initialIdx);
    useEffect(() => { setIdx(initialIdx()); }, [chain[0]]); // 换图重来（沿用死亡名单）

    return (
        <img
            src={chain[idx] ?? undefined}
            {...rest}
            onError={(e) => {
                if (idx === 0) {
                    const h = hostOf(resolved);
                    if (h) deadHosts.add(h); // 原链裂了 → 同图床后续直接走镜像
                }
                if (idx < chain.length - 1) setIdx(idx + 1);
                else onError?.(e); // 镜像全挂 → 交给调用方（真·裂图）
            }}
        />
    );
};

export default NetImg;
