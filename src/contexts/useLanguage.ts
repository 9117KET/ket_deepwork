import { useContext } from 'react'
import { LanguageContext } from './LanguageContext'

export function interpolate(template: string, params: Record<string, string | number>): string {
  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replace(`{${key}}`, String(value))
  }, template)
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return ctx
}

