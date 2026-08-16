// esm.sh 上的运行时 CDN 依赖：Vite 会原样保留这类 URL 动态 import，
// 但 tsc 解析不到，所以在这里按实际用法补一份环境声明（别把它们改成 npm 依赖）。

declare module 'https://esm.sh/html2canvas@1.4.1' {
    /** 只声明调用点用到的选项，需要别的再往上加 */
    export interface Html2CanvasOptions {
        backgroundColor: string | null;
        scale: number;
        useCORS: boolean;
        logging: boolean;
    }

    export default function html2canvas(
        element: HTMLElement,
        options?: Partial<Html2CanvasOptions>
    ): Promise<HTMLCanvasElement>;
}
