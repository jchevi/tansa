import i18next, { type i18n, type Module } from 'i18next'
import en from './locales/en.json'

export const defaultNS = 'translation'
// Every language file, registered here. locale-parity.test.ts fails if one is left out.
export const resources = { en: { translation: en } } as const

interface I18nOptions {
  // Warn about missing keys. The app passes import.meta.env.DEV.
  dev: boolean
}

// A new instance per call, so tests don't share state; src/i18n/index.ts builds the app's.
export function createI18n({ dev }: I18nOptions, plugins: Module[] = []): i18n {
  const instance = i18next.createInstance()
  for (const plugin of plugins) instance.use(plugin)
  void instance.init({
    // English only until Spanish lands; browser-language detection comes with it (R15).
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: ['en'],
    resources,
    defaultNS,
    // Resources are inline, so init finishes synchronously: no Suspense, no flash of keys.
    initAsync: false,
    // React already escapes text; escaping here too would show &amp; on screen.
    interpolation: { escapeValue: false },
    // A key missing in every language renders as the key itself [TAN-13]. i18next calls
    // missingKeyHandler only when saveMissing is on, so the warning is development-only.
    saveMissing: dev,
    missingKeyHandler: (languages, _namespace, key) => {
      console.warn(`[i18n] Missing key "${key}" (${languages.join(', ')})`)
    },
  })
  return instance
}
