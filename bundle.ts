import * as esbuild from "https://deno.land/x/esbuild@v0.20.1/mod.js";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.9";

await esbuild.build({
  plugins: [...denoPlugins()],
  entryPoints: ["public/app.ts"],
  outdir: "public/dist",
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "esnext",
  minify: true,
  sourcemap: true,
  treeShaking: true,
});

await esbuild.stop();