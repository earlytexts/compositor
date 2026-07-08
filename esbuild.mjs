import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  // .cjs, not .js: the package is "type": "module", but the extension host
  // loads the bundle with require(), so it must be unambiguously CommonJS.
  outfile: "dist/extension.cjs",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
  minify: false,
  // The corpus and markit come from JSR via its npm compatibility layer, under
  // their real registry names (@jsr/earlytexts__*). Using those names directly
  // (rather than npm aliases back to @earlytexts/*) is what lets npm hoist one
  // shared markit copy: the corpus's own dependency is declared as
  // @jsr/earlytexts__markit, and npm dedupes by package name. Both our imports
  // and the bundled corpus's therefore resolve to that single copy. (This
  // matters because markit tags compiled blocks with Symbol()s that only
  // compare equal within one module instance; a second copy would silently
  // break the markup-suggestion pipeline.)
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(buildOptions);
  console.log("Build complete.");
}
