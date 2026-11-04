import { initReactI18next } from 'react-i18next'
import { createI18n } from './config'

// The app's instance. initReactI18next makes it the one useTranslation() reads.
const i18n = createI18n({ dev: import.meta.env.DEV }, [initReactI18next])

export default i18n
