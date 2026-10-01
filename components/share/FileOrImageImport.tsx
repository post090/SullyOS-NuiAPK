import React, { useRef } from 'react';

/** A mixed image/text accept list can route Android pickers to Photos only. */
export function FileOrImageImport({ onChange, className, disabled = false, imageAccept = 'image/png' }: {
    onChange: React.ChangeEventHandler<HTMLInputElement>; className?: string; disabled?: boolean; imageAccept?: string;
}) {
    const files = useRef<HTMLInputElement>(null);
    const images = useRef<HTMLInputElement>(null);
    return <>
        <input ref={files} type="file" accept="*/*" hidden aria-label="从文件导入" onChange={onChange} />
        <input ref={images} type="file" accept={imageAccept} hidden aria-label="从图片导入" onChange={onChange} />
        <button type="button" className={className} disabled={disabled} onClick={() => files.current?.click()}>从文件导入</button>
        <button type="button" className={className} disabled={disabled} onClick={() => images.current?.click()}>从图片导入</button>
    </>;
}
