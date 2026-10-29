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
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  // Last, so formatting rules are left to Prettier.
  prettier,
])
