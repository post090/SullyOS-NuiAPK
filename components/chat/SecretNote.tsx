import React from 'react';

export default function SecretNote({text}: {text: string}) {
    return <aside aria-label="秘密小纸条" className="my-2 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-stone-700 shadow-sm">
        <div className="mb-2 text-xs font-medium text-amber-800">✉ 秘密小纸条</div>
        <p className="whitespace-pre-wrap break-words leading-relaxed">{text}</p>
    </aside>;
}
