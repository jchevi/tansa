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

// UI text: any letter in any script, so '60 min' and '保存' are text but '·', '+' and '60'
// are not. JSXText value is decoded, so &nbsp; is not a letter [TAN-13].
const letter = '/\\p{L}/u'
// A string value: a literal, a template without ${}, a ternary branch or the right side of
// &&, || and ??. Read from a JSX child or attribute container, or an attribute itself.
const textValues = [
  `Literal[value=${letter}]`,
  `TemplateLiteral[expressions.length=0] > TemplateElement[value.raw=${letter}]`,
  `ConditionalExpression > Literal[value=${letter}]`,
  `ConditionalExpression > TemplateLiteral[expressions.length=0] > TemplateElement[value.raw=${letter}]`,
  `LogicalExpression > Literal[value=${letter}]`,
  `LogicalExpression > TemplateLiteral[expressions.length=0] > TemplateElement[value.raw=${letter}]`,
]
const textAttribute =
  'JSXAttribute[name.name=/^(aria-(label|braillelabel|description|roledescription|placeholder|valuetext)|title|alt|placeholder|label)$/]'
const dialogCall =
  'CallExpression:matches([callee.name=/^(alert|confirm|prompt)$/], [callee.object.name="window"][callee.property.name=/^(alert|confirm|prompt)$/])'
const textSelectors = [
  `JSXText[value=${letter}]`,
  ...textValues.map(
    (value) => `:matches(JSXElement, JSXFragment) > JSXExpressionContainer > ${value}`,
  ),
  `${textAttribute} > Literal[value=${letter}]`,
  ...textValues.map((value) => `${textAttribute} > JSXExpressionContainer > ${value}`),
  `${dialogCall} > Literal[value=${letter}]`,
  `${dialogCall} > TemplateLiteral > TemplateElement[value.raw=${letter}]`,
]

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
    files: ['src/**/*.test.{ts,tsx}', '.claude/hooks/**/*.test.ts'],
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
    // UI text lives only in src/i18n/locales; code uses t() [TAN-13].
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
        // In the same rule as the colors: a second block for no-restricted-syntax would
        // replace these options, not add to them [TAN-13].
        ...textSelectors.map((selector) => ({
          selector,
          message: 'No hard-coded UI text: add it to src/i18n/locales/en.json and use t().',
        })),
      ],
    },
  },
  {
    // Local-first: the data layer never talks to the network [TAN-14]. Known gaps:
    // bracket access (globalThis['fetch']), dynamic import(), a URL set as an image or
    // element src, and aliases (const g = globalThis; g.fetch()). The runtime test in
    // src/data/no-network.test.ts covers the paths it runs.
    // These rules are set by no other block, so neither block replaces the other's
    // options (see the no-restricted-syntax note above).
    files: ['src/data/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...[
          'fetch',
          'XMLHttpRequest',
          'WebSocket',
          'EventSource',
          'WebTransport',
          'RTCPeerConnection',
        ].map((name) => ({ name, message: 'The data layer makes no network requests.' })),
      ],
      'no-restricted-properties': [
        'error',
        ...[
          ['navigator', 'sendBeacon'],
          ['window', 'fetch'],
          ['globalThis', 'fetch'],
          ['self', 'fetch'],
        ].map(([object, property]) => ({
          object,
          property,
          message: 'The data layer makes no network requests.',
        })),
      ],
      'no-restricted-imports': [
        'error',
        {
          // An allow-list: idb and relative modules only, so no network library gets in.
          patterns: [
            {
              regex: '^(?!idb$|\\.{1,2}/)',
              message: 'src/data imports only idb and its own modules.',
            },
          ],
        },
      ],
    },
  },
  {
    // Components never touch IndexedDB: they go through src/data [TAN-14].
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/data/**', '**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'indexedDB', message: 'Use the data layer in src/data.' },
      ],
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'idb', message: 'Use the data layer in src/data.' }] },
      ],
    },
  },
  {
    // The review-loop hooks run in Node, not the browser [TAN-34].
    files: ['.claude/hooks/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  // Last, so formatting rules are left to Prettier.
  prettier,
])
