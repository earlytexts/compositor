import * as esbuild from "esbuild";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

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
  // @earlytexts/corpus is a file: link to the sibling checkout; resolve its
  // imports through the symlink so they find this package's node_modules.
  preserveSymlinks: true,
  // The corpus is a Node package now, so it carries its own
  // node_modules/@earlytexts/markit. While it's a file: link (rather than a
  // published npm dep that npm would hoist to one shared copy), preserveSymlinks
  // lets the bundled corpus source resolve markit there — a SECOND copy — and
  // markit tags blocks with Symbol()s that only compare equal within one
  // instance, so the two halves of the suggestion pipeline would silently stop
  // matching. Pin every markit import (ours and the corpus's) to this package's
  // one copy. (Once the corpus is published to npm and hoisted, this alias — and
  // preserveSymlinks — become harmless no-ops and can go.)
  alias: { "@earlytexts/markit": require.resolve("@earlytexts/markit") },
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(buildOptions);
  console.log("Build complete.");
}
