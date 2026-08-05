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
  },
  overrides: [
    {
      files: ['api/**/*.js', 'vite.config.js', 'vite-api-proxy.js', '.eslintrc.cjs'],
      env: { node: true },
    }
  ],
}
