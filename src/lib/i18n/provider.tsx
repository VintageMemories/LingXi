'use client'

import { I18nContext, useI18nState } from './index'

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const i18n = useI18nState()

  return (
    <I18nContext.Provider value={i18n}>
      {children}
    </I18nContext.Provider>
  )
}
