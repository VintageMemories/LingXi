'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import zhLocale from './locales/zh.json'
import enLocale from './locales/en.json'

export type Locale = 'zh' | 'en'
export type TranslationValue = string | number | boolean

const STORAGE_KEY = 'lingxi_language'

const locales: Record<Locale, Record<string, unknown>> = {
  zh: zhLocale,
  en: enLocale,
}

// Get nested value from object by dot-notation path
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'string' ? current : undefined
}

// Replace {key} placeholders with values
function interpolate(template: string, params?: Record<string, TranslationValue>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key]
    return value !== undefined ? String(value) : match
  })
}

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, TranslationValue>) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

export function useTranslation() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider')
  }
  return context
}

export { I18nContext, type I18nContextType, STORAGE_KEY }

export function useI18nState() {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return 'zh'
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'en' || saved === 'zh') return saved
    } catch {
      // Ignore
    }
    return 'zh'
  })

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    try {
      localStorage.setItem(STORAGE_KEY, newLocale)
    } catch {
      // Ignore
    }
  }, [])

  const t = useCallback((key: string, params?: Record<string, TranslationValue>): string => {
    const translations = locales[locale]
    const fallbackTranslations = locales['zh']
    
    // Try current locale first, then fallback to Chinese
    let value = getNestedValue(translations, key)
    if (value === undefined) {
      value = getNestedValue(fallbackTranslations, key)
    }
    
    if (value === undefined) {
      // Return the key itself as last resort
      return key
    }
    
    return interpolate(value, params)
  }, [locale])

  return { locale, setLocale, t }
}
