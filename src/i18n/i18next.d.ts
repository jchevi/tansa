import 'i18next'
import type { defaultNS, resources } from './config'

// Types t() keys from en.json: an unknown key is a compile error [TAN-13].
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    resources: (typeof resources)['en']
  }
}
