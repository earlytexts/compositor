import { defineConfig } from "vitest/config";

// The corpus is a file: dependency (a Deno checkout with no node_modules of
// its own), so its `@earlytexts/markit` import and the tests' resolve to the
// same physical package but, without help, to two module records. Markit tags
// compiled blocks with Symbol()s (startLine/endLine); those are only equal
// within one instance, so `scanSource` (in the corpus) must read the very
// blocks `compile` (in a test) produced from the SAME markit. The production
// esbuild bundle guarantees this via preserveSymlinks; dedupe does it here.
export default defineConfig({
  resolve: {
    dedupe: ["@earlytexts/markit", "@earlytexts/corpus"],
  },
});
