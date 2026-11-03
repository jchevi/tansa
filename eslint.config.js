import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import playwright from 'eslint-plugin-playwright'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results', 'blob-report']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['e2e/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      // Every test title starts with its Jira key, e.g. "@TAN-17 home screen" [TAN-10].
      'playwright/valid-title': [
        'error',
        {
          mustMatch: {
            test: ['^@TAN-\\d+ ', 'Test titles must start with the Jira key, e.g. "@TAN-17 …"'],
          },
        },
      ],
    },
  },
  {
    // Colors live only in src/theme/tokens.css; code uses var(--color-*) [TAN-12].
    // Hex is matched anywhere in a string (e.g. '1px solid #fff'), so a hex-shaped word
    // like '#add' is a false positive: disable the line with a reason if that happens.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...['Literal[value=/', 'TemplateElement[value.raw=/'].flatMap((node) => [
          {
            selector: `${node}(^|[\\s,(:])#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\\b/i]`,
            message: 'No hard-coded hex colors: use a var(--color-*) token from src/theme.',
          },
          {
            selector: `${node}\\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\(/i]`,
            message: 'No hard-coded color functions: use a var(--color-*) token from src/theme.',
          },
        ]),
      ],
    },
  },
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  // Last, so formatting rules are left to Prettier.
  prettier,
])
