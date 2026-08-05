module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  // api/_vendor holds byte-for-byte vendored third-party code (see
  // api/_vendor/entities/README.md) — not first-party, shouldn't be linted
  // as if it were (its inline disable-comments reference plugins this
  // project doesn't install, which otherwise throws fatal config errors).
  ignorePatterns: ['dist', '.eslintrc.cjs', 'api/_vendor'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // This codebase deliberately never uses PropTypes (confirmed convention
    // throughout the project — components rely on being small, co-located
    // with their callers, and TypeScript-free by choice). Leaving this on
    // makes `npm run lint` report ~300+ "errors" that are all expected
    // no-ops, which drowns out real issues and makes the command useless as
    // a CI gate. Off, not just downgraded to warn, since it'll never be
    // addressed and warnings would just be permanent noise too.
    'react/prop-types': 'off',
    // Raw apostrophes/quotes in JSX text ("don't", "here's") are normal
    // English and appear throughout this codebase's copy — not a real risk
    // here (no dynamic HTML injection involved), just noise against the
    // established writing style.
    'react/no-unescaped-entities': 'off',
    // Established convention: `catch { }` / `catch { /* ignore */ }` for
    // deliberately-swallowed, non-actionable errors (localStorage writes,
    // best-effort cleanup, etc.) — allowEmptyCatch matches that pattern
    // specifically while still catching a genuinely empty `if`/function
    // body elsewhere, which usually *is* a mistake worth flagging.
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
  overrides: [
    {
      files: ['api/**/*.js', 'vite.config.js', 'vite-api-proxy.js', '.eslintrc.cjs'],
      env: { node: true },
    }
  ],
}
