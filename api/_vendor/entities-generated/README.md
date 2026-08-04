# Vendored `entities` generated data files

These three files are byte-for-byte copies of
`node_modules/entities@4.5.0/lib/generated/*.js` (decode/encode lookup
tables `entities`'s own build script generates — not hand-written).

## Why they're here

Vercel's function bundler drops `node_modules/entities/lib/generated/`
from the deployed `api/upcoming.js` function, regardless of `vercel.json`
`includeFiles` config (tried and confirmed ineffective — see the debug
history comment in `api/upcoming.js`). `entities/lib/decode.js` and
`entities/lib/encode.js` load these files via a static, relative
`require("./generated/...")` — since that's a relative path inside a
third-party package, it can't be redirected without patching the package
itself. Instead, `api/upcoming.js` pre-populates Node's CJS module cache
for the exact absolute paths those two files expect, using content loaded
from these vendored copies, *before* `cheerio` (and therefore `entities`)
is ever required. See `preloadEntitiesGeneratedFiles()` in
`api/upcoming.js`.

## If `entities` is ever upgraded

Re-copy these three files from the new version's
`node_modules/entities/lib/generated/` directory. If entities changes
which generated files exist or their export shape, update both these
files and `preloadEntitiesGeneratedFiles()` together.
