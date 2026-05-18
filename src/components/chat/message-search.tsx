'use client'

import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/stores/chat-store'
import { useTranslation } from '@/lib/i18n'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'

export function MessageSearch() {
  const { t } = useTranslation()
  const isSearchOpen = useChatStore((s) => s.isSearchOpen)
  const setIsSearchOpen = useChatStore((s) => s.setIsSearchOpen)
  const searchQuery = useChatStore((s) => s.searchQuery)
  const setSearchQuery = useChatStore((s) => s.setSearchQuery)
  const searchMatches = useChatStore((s) => s.searchMatches)
  const currentMatchIndex = useChatStore((s) => s.currentMatchIndex)
  const navigateMatch = useChatStore((s) => s.navigateMatch)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isSearchOpen])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setIsSearchOpen(false)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        navigateMatch('prev')
      } else {
        navigateMatch('next')
      }
    }
  }, [setIsSearchOpen, navigateMatch])

  useEffect(() => {
    if (currentMatchIndex < 0 || searchMatches.length === 0) return
    const currentMatch = searchMatches[currentMatchIndex]
    if (!currentMatch) return

    const messageEl = document.querySelector(`[data-message-id="${currentMatch.messageId}"]`)
    if (messageEl) {
      messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' })

      const highlights = messageEl.querySelectorAll('.search-highlight')
      const msgMatches = searchMatches.filter(m => m.messageId === currentMatch.messageId)
      const matchIdx = msgMatches.indexOf(currentMatch)
      if (matchIdx >= 0 && highlights[matchIdx]) {
        highlights[matchIdx].classList.add('search-highlight-active')
        setTimeout(() => {
          highlights[matchIdx]?.classList.remove('search-highlight-active')
        }, 1500)
      }
    }
  }, [currentMatchIndex, searchMatches])

  const matchCount = searchMatches.length
  const displayIndex = currentMatchIndex >= 0 ? currentMatchIndex + 1 : 0

  return (
      <AnimatePresence>
        {isSearchOpen && (
            <motion.div
                initial={{ opacity: 0, y: -20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -20, height: 0 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="border-b border-border/50 bg-background/95 backdrop-blur-sm"
            >
              <div className="mx-auto max-w-4xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                  <Input
                      ref={inputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('search.searchContent')}
                      className="h-8 flex-1 rounded-md border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50"
                  />

                  {searchQuery.trim() && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[60px] text-center">
                  {matchCount > 0 ? t('search.matchFormat', { current: displayIndex, total: matchCount }) : t('search.noMatch')}
                </span>
                  )}

                  <div className="flex items-center gap-0.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md"
                        onClick={() => navigateMatch('prev')}
                        disabled={matchCount === 0}
                        aria-label={t('search.previous')}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md"
                        onClick={() => navigateMatch('next')}
                        disabled={matchCount === 0}
                        aria-label={t('search.next')}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
                      onClick={() => setIsSearchOpen(false)}
                      aria-label={t('search.closeSearch')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
        )}
      </AnimatePresence>
  )
}