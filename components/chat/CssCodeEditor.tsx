import {portableCssImages} from '../../utils/cssImageAssets';
import React, {useMemo, useState} from 'react';
import {compactCssImages} from '../../utils/cssImagePlaceholders';

export default function CssCodeEditor({value, onChange, ...props}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'|'onChange'> & {value: string; onChange: (value: string) => void}) {
    const compact = useMemo(() => compactCssImages(value), [value]);
    const [notice, setNotice] = useState('');
    return <>
        <textarea {...props} value={compact.text} onChange={event => onChange(compact.expand(event.target.value))}/>
        {(compact.count > 0 || value.includes('blobref:')) && <><p>图片使用短名称显示；复制完整 CSS 时会包含图片。</p>
            <button type="button" disabled={props.disabled} onClick={async () => {
                try { await navigator.clipboard.writeText(await portableCssImages(value)); setNotice('已复制完整 CSS'); }
                catch { setNotice('复制失败，请重试'); }
            }}>复制完整 CSS（含图片）</button>
            {notice && <p role="status">{notice}</p>}
        </>}
    </>;
}
