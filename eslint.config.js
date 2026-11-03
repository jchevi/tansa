import js from '@eslint/js'
import vitest from '@vitest/eslint-plugin'
import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import playwright from 'eslint-plugin-playwright'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Values a color property may take: a token, color-mix() or url(), or a keyword.
const allowedColor =
  '(var|color-mix|url)\\(|(transparent|currentcolor|inherit|initial|unset|revert|none)$'
// Style object keys that hold a color, as identifiers or quoted (background-color) [TAN-29].
const colorKey = '/^(color|fill|stroke|background|[a-zA-Z]+Color|[a-z-]+-color)$/'
// Color attributes on lower-case (DOM and SVG) elements only: <Button color="primary">
// is a component prop. freeze and remove are SMIL fill modes, not colors [TAN-29].
const colorAttribute =
  'JSXOpeningElement[name.name=/^[a-z]/] > JSXAttribute[name.name=/^(fill|stroke|color|stop-color|flood-color|lighting-color|stopColor|floodColor|lightingColor)$/]'
const attributeValue = `/^(?!${allowedColor}|(freeze|remove)$)/i`
const canvasStyle = 'AssignmentExpression[left.property.name=/^(fill|stroke)Style$/]'

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
    // Vitest titles start with the Jira key too; describe() only groups, so it is free [TAN-31].
    files: ['src/**/*.test.{ts,tsx}'],
    plugins: { vitest },
    rules: {
      'vitest/valid-title': [
        'error',
        {
          mustMatch: {
            it: ['^@TAN-\\d+ ', 'Test titles must start with the Jira key, e.g. "@TAN-17 …"'],
            test: ['^@TAN-\\d+ ', 'Test titles must start with the Jira key, e.g. "@TAN-17 …"'],
          },
        },
      ],
    },
  },
  {
    // Colors live only in src/theme/tokens.css; code uses var(--color-*) [TAN-12].
    // Hex is matched anywhere in a string (e.g. '1px solid #fff', fill='#fff'), so a
    // hex-shaped word like '#add' is a false positive: disable the line with a reason.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...['Literal[value=/', 'TemplateElement[value.raw=/', 'JSXText[value=/'].flatMap((node) => [
          {
            selector: `${node}(^|[\\s,(:'"=/])#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\\b/i]`,
            message: 'No hard-coded hex colors: use a var(--color-*) token from src/theme.',
          },
          {
            selector: `${node}\\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|device-cmyk)\\(/i]`,
            message: 'No hard-coded color functions: use a var(--color-*) token from src/theme.',
          },
          {
            // A color-mix() argument that is a word but not var() or a keyword, optionally
            // after a percentage. Stays inside one level of parentheses, so a later part of
            // a multi-part value isn't read as an argument [TAN-29].
            selector: `${node}color-mix\\((?:[^()]|\\([^()]*\\))*?,\\s*(?:[\\d.]+%\\s+)?(?!var\\(|transparent\\b|currentcolor\\b)[a-z]/i]`,
            message: 'color-mix() takes var(--color-*) tokens, not named or system colors.',
          },
        ]),
        ...[
          // Named and system colors (white, Canvas) on a color property. An allow-list,
          // because the names are too many to list. Shorthands like border are not covered.
          `Property:matches([key.name=${colorKey}], [key.value=${colorKey}])[value.value=/^(?!${allowedColor})/i]`,
          // Template literals without ${}: their one piece is the whole value [TAN-29].
          `Property:matches([key.name=${colorKey}], [key.value=${colorKey}]) > TemplateLiteral[expressions.length=0] > TemplateElement[value.raw=/^(?!${allowedColor})/i]`,
          // JSX color attributes: a string, {'…'}, {`…`} or either branch of {a ? b : c}.
          `${colorAttribute} > Literal[value=${attributeValue}]`,
          `${colorAttribute} > JSXExpressionContainer > Literal[value=${attributeValue}]`,
          `${colorAttribute} > JSXExpressionContainer > ConditionalExpression > Literal[value=${attributeValue}]`,
          `${colorAttribute} > JSXExpressionContainer > TemplateLiteral[expressions.length=0] > TemplateElement[value.raw=${attributeValue}]`,
        ].map((selector) => ({
          selector,
          message:
            'Color properties take a var(--color-*) token or a keyword (transparent, currentColor, inherit, none).',
        })),
        ...[
          `${canvasStyle} > :matches(Literal, TemplateLiteral[expressions.length=0])`,
          `${canvasStyle} > ConditionalExpression > :matches(Literal, TemplateLiteral[expressions.length=0])`,
        ].map((selector) => ({
          selector,
          // Any fixed string, tokens included: canvas never resolves var(). A template
          // with ${} carries a value resolved at runtime, so it is allowed [TAN-29].
          message:
            'Canvas cannot read var(): resolve the token with getComputedStyle and assign that value.',
        })),
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
