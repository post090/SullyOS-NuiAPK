import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
    define:{__BUILD_BRANCH__:JSON.stringify('codex/dino-cafe-art'),__BUILD_COMMIT__:JSON.stringify('local-preview'),__BUILD_TIME__:JSON.stringify('local-preview'),__BUILD_BADGE_VISIBLE__:'true'},
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: {host:'127.0.0.1',port:5182,strictPort:true,fs:{allow:[fileURLToPath(new URL('../../../..',import.meta.url))]}},
    build: {outDir:'output/dino-cafe-build',rollupOptions:{input:fileURLToPath(new URL('./index.html',import.meta.url))}},
});
