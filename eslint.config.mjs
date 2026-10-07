// ESLint flat config.
//
// typescript-eslint drives TypeScript's JavaScript API, which TypeScript 7 (the
// native compiler this project builds with) does not ship. Microsoft publishes
// TypeScript 6's API as @typescript/typescript6 for exactly this, so the hook
// below hands that package to typescript-eslint whenever it asks for
// "typescript". It must be registered before typescript-eslint is loaded,
// hence the dynamic imports.

import { registerHooks } from 'node:module';

const LINT_TOOLING = /[\\/]node_modules[\\/](?:@typescript-eslint[\\/]|typescript-eslint[\\/]|ts-api-utils[\\/])/;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier === 'typescript' || specifier.startsWith('typescript/')) && LINT_TOOLING.test(context.parentURL ?? '')) {
      return nextResolve(specifier.replace('typescript', '@typescript/typescript6'), context);
    }
    return nextResolve(specifier, context);
  },
});

const { default: js } = await import('@eslint/js');
const { default: tseslint } = await import('typescript-eslint');
const { default: reactHooks } = await import('eslint-plugin-react-hooks');
const { default: prettier } = await import('eslint-config-prettier');
const { default: globals } = await import('globals');

export default tseslint.config(
  { ignores: ['node_modules/', 'out/', 'dist/', 'release/', 'resources/', 'website/'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      // Fire-and-forget handlers (onClick={() => save()}) are the norm in the UI;
      // useTask reports their errors. Promises elsewhere must still be handled.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      // `async` without `await` is deliberate in the IPC layer: it turns a
      // synchronous throw into a rejected promise the renderer can handle.
      '@typescript-eslint/require-await': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'off',
    },
  },

  // Node: the core, the CLI, the app's sidecar, tests and tooling.
  {
    files: ['src/core/**', 'src/cli/**', 'src/sidecar/**', 'test/**', '*.config.ts', '*.config.mjs'],
    languageOptions: { globals: globals.node },
  },

  // Renderer (React).
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  // Plain JavaScript (bin shim, scripts) has no tsconfig to type-check against.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['bin/**/*.js'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  // Formatting is Prettier's job.
  prettier,
);
