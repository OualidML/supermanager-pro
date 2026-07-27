import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import translationEN from '../locales/en.json'
import translationFR from '../locales/fr.json'
import translationAR from '../locales/ar.json'

const resources = {
  en: { translation: translationEN },
  fr: { translation: translationFR },
  ar: { translation: translationAR }
}

const savedLang = localStorage.getItem('app_language') || 'en'

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  })

export default i18n
