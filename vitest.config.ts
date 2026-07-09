import { defineConfig } from "vitest/config";

// The corpus comes from JSR's npm compatibility layer and declares its markit
// dependency under the same real registry name we use (@jsr/earlytexts__markit),
// so npm hoists a single markit copy that the corpus, our own hints.ts, and the
// tests all resolve to. That single instance is what keeps `scanSource` (our
// hints.ts) reading the very blocks `buildCatalogue` (the corpus) and `compile`
// (a test) produced — markit tags blocks with Symbol()s (startLine/endLine)
// that only compare equal within one instance. No dedupe is needed; if Vite
// ever splits the copy into two module records, reinstate
// `resolve.dedupe: ["@jsr/earlytexts__markit"]` here.
export default defineConfig({});
