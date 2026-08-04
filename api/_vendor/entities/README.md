# Vendored `entities` package

Byte-for-byte copies of `node_modules/entities@4.5.0/lib/**/*.js` (the
`.js` runtime files only — no `.d.ts`/`.js.map`, and excluding a handful
of stray `* 2.js` duplicate files present in local installs that aren't
part of the real npm package).

## Why this exists

Vercel's function bundler drops files from `node_modules/entities/lib/`
in the deployed `api/upcoming.js` function — confirmed to affect multiple
different files across several debugging rounds (first
`lib/generated/decode-data-html.js`, then `lib/escape.js` once the first
gap was patched around), regardless of `vercel.json` `includeFiles`
config (tried and confirmed twice, ineffective for any target — see the
debug history comment in `api/upcoming.js`). Rather than continuing to
patch individual missing files one at a time as they surface, this
vendors the entire `entities` package.

`api/upcoming.js`'s `patchEntitiesGeneratedResolution()` patches
`Module._resolveFilename`: it always tries real resolution first (so
this is a complete no-op the moment Vercel's bundling behavior is ever
fixed), and only falls back to the matching file in this vendored copy
when resolution fails for a request originating from within
`node_modules/entities`.

`package.json` here sets `"type": "commonjs"` — the project root's
`"type": "module"` would otherwise make Node treat these vendored `.js`
files as ES modules when `require()`'d.

## If `entities` is ever upgraded

Re-copy `node_modules/entities/lib/**/*.js` (skip `.d.ts`/`.map`/stray
`* 2.js` files) into `api/_vendor/entities/lib/`, preserving the
directory structure.
