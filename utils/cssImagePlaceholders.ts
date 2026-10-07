/** Keep embedded images out of text layout without changing the saved CSS. */
export function compactCssImages(css: string) {
    const images = new Map<string, string>();
    const text = css.replace(/data:image\/[\w.+-]+;base64,[a-z\d+/=\r\n]+/gi, image => {
        let token = `sully-embedded-image-${images.size + 1}`;
        while (css.includes(token)) token += '-asset';
        images.set(token, image);
        return token;
    });
    return {
        text,
        count: images.size,
        expand: (edited: string) => edited.replace(/sully-embedded-image-\d+(?:-asset)*/g, token => images.get(token) ?? token),
    };
}
