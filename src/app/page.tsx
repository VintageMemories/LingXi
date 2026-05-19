'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useChatStore, type ChatMessage } from '@/stores/chat-store'
import { useTranslation } from '@/lib/i18n'
import { useSSEChat } from '@/hooks/use-sse-chat'
import { ChatHeader } from '@/components/chat/chat-header'
import { ConversationSidebar } from '@/components/chat/conversation-sidebar'
import { WelcomeScreen } from '@/components/chat/welcome-screen'
import { MessageBubble } from '@/components/chat/message-bubble'
import { MessageItem } from '@/components/chat/message-item'
import { MessageSearch } from '@/components/chat/message-search'
import { ConversationStats } from '@/components/chat/conversation-stats'
import { SubscriptionDialog } from '@/components/chat/subscription-dialog'
import { ActivateDialog } from '@/components/chat/activate-dialog'
import { ChatInput } from '@/components/chat/chat-input'
import { ErrorBoundary } from '@/components/chat/error-boundary'
import { usePresence } from '@/hooks/use-presence'
import { AlertTriangle, ArrowDown, Pin, Zap, Cpu, Coins } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { List, useDynamicRowHeight, useListRef } from 'react-window'

function formatDateSeparator(timestamp: number, t: (key: string, params?: Record<string, string | number>) => string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24))
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  if (diffDays === 0) return t('messages.todayWithTime', { time: timeStr })
  if (diffDays === 1) return t('messages.yesterdayWithTime', { time: timeStr })
  const month = date.getMonth() + 1
  const day = date.getDate()
  return t('messages.dateFormat', { month, day, time: timeStr })
}

function shouldShowDateSeparator(prev: ChatMessage | null, current: ChatMessage): boolean {
  if (!prev) return true
  return current.timestamp - prev.timestamp > 5 * 60 * 1000
}

interface FlatItem {
  type: 'separator' | 'message'
  message?: ChatMessage
  separatorLabel?: string
  timestamp?: number
  messageId?: string
}

function buildFlatItems(messages: ChatMessage[]): FlatItem[] {
  const items: FlatItem[] = []
  for (let i = 0; i < messages.length; i++) {
    const prevMessage = i > 0 ? messages[i - 1] : null
    const showSep = shouldShowDateSeparator(prevMessage, messages[i])
    if (showSep) {
      items.push({ type: 'separator', separatorLabel: '', timestamp: messages[i].timestamp, messageId: messages[i].id })
    }
    items.push({ type: 'message', message: messages[i], messageId: messages[i].id })
  }
  return items
}

function EnhancedFooter({ domainIcon, domainDisplayName, disclaimerText, messageCount }: {
  readonly domainIcon: string
  readonly domainDisplayName: string
  readonly disclaimerText: string
  readonly messageCount: number
}) {
  const { t } = useTranslation()
  const isConnected = useChatStore((s) => s.isConnected)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const lastResponseLatency = useChatStore((s) => s.lastResponseLatency)
  const sessionId = useChatStore((s) => s.sessionId)
  const currentModel = useChatStore((s) => s.currentModel)
  const totalTokenUsage = useChatStore((s) => s.totalTokenUsage)
  const setIsConnected = useChatStore((s) => s.setIsConnected)

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health')
        setIsConnected(res.ok)
      } catch { setIsConnected(false) }
    }
    void checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [setIsConnected])

  const latencyColor = lastResponseLatency === null ? 'text-muted-foreground/50'
      : lastResponseLatency < 2000 ? 'text-emerald-500'
          : lastResponseLatency < 5000 ? 'text-yellow-500'
              : 'text-red-500'

  const shortSessionId = sessionId ? `#${sessionId.slice(0, 4)}...` : null

  return (
      <div className="relative">
        <div className="gradient-border-animated h-px w-full" />
        <div className="bg-muted/30 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl px-4 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1.5">
                  {isConnected ? (
                      <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  ) : (
                      <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                  )}
                  <span className="text-[11px] text-muted-foreground/80 truncate">{domainIcon} {domainDisplayName}</span>
                </div>
              </div>
              <p className="hidden md:flex items-center justify-center gap-1 text-[10px] text-muted-foreground/60 truncate flex-1 mx-2">
                <AlertTriangle className="h-2.5 w-2.5 flex-shrink-0" />{disclaimerText}
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                {lastResponseLatency !== null && (
                    <span className={`flex items-center gap-0.5 text-[10px] ${latencyColor}`}>
                  <Zap className="h-2.5 w-2.5" />
                      {lastResponseLatency < 1000 ? `${lastResponseLatency}ms` : `${(lastResponseLatency / 1000).toFixed(1)}s`}
                </span>
                )}
                {mounted && totalTokenUsage.totalTokens > 0 && (
                    <span className="hidden sm:flex items-center gap-0.5 text-[10px] text-amber-600/70 dark:text-amber-400/70">
                  <Coins className="h-2.5 w-2.5" />{t('footer.tokenUsage', { count: totalTokenUsage.totalTokens.toLocaleString() })}
                </span>
                )}
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/50">
                <Cpu className="h-2.5 w-2.5" />{currentModel || '...'}
              </span>
                <span className="text-[10px] text-muted-foreground/50">{messageCount} {t('footer.messagesUnit')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
  )
}

function SessionLoadingSkeleton() {
  return (
      <div className="space-y-6 px-4 py-6">
        {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="flex-shrink-0"><div className="skeleton-shimmer-enhanced h-8 w-8 rounded-full" /></div>
              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer-enhanced h-4 w-3/4 rounded-md" />
                <div className="skeleton-shimmer-enhanced h-4 w-1/2 rounded-md" />
              </div>
            </div>
        ))}
      </div>
  )
}

function PinnedSection({ messages, t }: { readonly messages: ChatMessage[]; readonly t: (key: string, params?: Record<string, string | number>) => string }) {
  return (
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-2">
          <Pin className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{t('messages.pinnedMessages')}</span>
          <span className="text-[10px] text-muted-foreground">({messages.filter(m => m.pinned).length})</span>
        </div>
        <div className="space-y-2">
          {messages.filter(m => m.pinned).map((pinnedMsg) => (
              <button key={pinnedMsg.id} className="w-full text-left rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors px-3 py-2 group"
                      onClick={() => {
                        const el = document.querySelector(`[data-message-id="${pinnedMsg.id}"]`)
                        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ring-2', 'ring-amber-500/50'); setTimeout(() => el.classList.remove('ring-2', 'ring-amber-500/50'), 2000) }
                      }}>
                <div className="flex items-start gap-2">
                  <Pin className="h-3 w-3 mt-0.5 text-amber-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground line-clamp-2">{pinnedMsg.content.slice(0, 120)}{pinnedMsg.content.length > 120 ? '...' : ''}</p>
                    <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">{new Date(pinnedMsg.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </button>
          ))}
        </div>
      </div>
  )
}

function ActivateDialogWrapper() {
  const isActivateOpen = useChatStore((s) => s.isActivateOpen)
  const setIsActivateOpen = useChatStore((s) => s.setIsActivateOpen)
  return <ActivateDialog open={isActivateOpen} onOpenChange={setIsActivateOpen} />
}

export default function Home() {
  const { t } = useTranslation()
  const messages = useChatStore((s) => s.messages)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const currentDomain = useChatStore((s) => s.currentDomain)
  const isLoadingSession = useChatStore((s) => s.isLoadingSession)
  const settings = useChatStore((s) => s.settings)
  const searchQuery = useChatStore((s) => s.searchQuery)
  const searchMatches = useChatStore((s) => s.searchMatches)
  const currentMatchIndex = useChatStore((s) => s.currentMatchIndex)
  const setUser = useChatStore((s) => s.setUser)
  const setActiveUsers = useChatStore((s) => s.setActiveUsers)
  const setTypingUsers = useChatStore((s) => s.setTypingUsers)
  const { sendMessage, stopStreaming, regenerateMessage } = useSSEChat()
  const presence = usePresence()

  useEffect(() => { setActiveUsers(presence.activeUsers) }, [presence.activeUsers, setActiveUsers])
  useEffect(() => { setTypingUsers(presence.typingUsers) }, [presence.typingUsers, setTypingUsers])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(0)
  const containerMeasurerRef = useRef<HTMLDivElement>(null)
  const dynamicRowHeight = useDynamicRowHeight({ defaultRowHeight: 120 })
  const listRef = useListRef()
  const [showScrollButton, setShowScrollButton] = useState(false)

  const isSearchActive = searchQuery && searchQuery.trim().length > 0
  const useVirtualization = messages.length > 50 && !isSearchActive
  const flatItems = useMemo(() => buildFlatItems(messages), [messages])

  useEffect(() => {
    const container = containerMeasurerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => { for (const entry of entries) setContainerHeight(entry.contentRect.height) })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const { scrollTop, scrollHeight, clientHeight } = container
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 200)
  }, [])

  const scrollToBottom = useCallback(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [])

  useEffect(() => { if (settings.autoScroll && messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }) }, [messages, settings.autoScroll])

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('lingxi_user')
      if (storedUser) {
        const parsed = JSON.parse(storedUser)
        fetch(`/api/auth?user_id=${parsed.id}`)
          .then(r => r.ok ? r.json() : Promise.reject())
          .then(() => setUser(parsed))
          .catch(() => {
            localStorage.removeItem('lingxi_user')
            localStorage.removeItem('lingxi_token')
          })
      }
    } catch { /* ignore */ }
  }, [setUser])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'b') { e.preventDefault(); useChatStore.getState().toggleSidebar() }
      if (e.ctrlKey && e.shiftKey && e.key === 'N') { e.preventDefault(); useChatStore.getState().startNewChat() }
      if (e.ctrlKey && e.key === '/') { e.preventDefault(); useChatStore.getState().setIsShortcutsOpen(true) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        const store = useChatStore.getState()
        if (store.messages.length > 0) store.setIsSearchOpen(true)
      }
    }
    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSuggestionClick = (text: string) => { void sendMessage(text) }

  const domainDisplayName = currentDomain?.display_name || t('domains.default')
  const domainIcon = currentDomain?.icon || '🤖'
  const disclaimerKey = currentDomain?.id === 'medical' ? 'footer.disclaimerMedical' : currentDomain?.id === 'legal' ? 'footer.disclaimerLegal' : currentDomain?.id === 'finance' ? 'footer.disclaimerFinance' : 'footer.disclaimerDefault'
  const disclaimerText = t(disclaimerKey)
  const messageCount = messages.length
  const hasPinned = messages.some(m => m.pinned)

  return (
      <ErrorBoundary>
        <div className="flex h-screen bg-background">
          <ConversationSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <ChatHeader />
            <MessageSearch />
            <div className="relative flex flex-1 flex-col overflow-hidden chat-area-bg" ref={containerMeasurerRef}>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-primary/[0.01] to-primary/[0.03] z-0" />
              <div className="pointer-events-none absolute inset-0 chat-dot-pattern z-0 opacity-60" />
              <div ref={!useVirtualization ? scrollContainerRef : undefined} onScroll={!useVirtualization ? handleScroll : undefined} className="relative z-10 flex-1 overflow-y-auto">
                <div className="mx-auto max-w-4xl">
                  <AnimatePresence mode="wait">
                    {isLoadingSession ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}><SessionLoadingSkeleton /></motion.div>
                    ) : messages.length === 0 ? (
                        <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: 'easeOut' }}><WelcomeScreen onSuggestionClick={handleSuggestionClick} /></motion.div>
                    ) : useVirtualization && containerHeight > 0 ? (
                        <motion.div key="messages-virtualized" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                          {hasPinned && <div className="px-4 pt-6"><PinnedSection messages={messages} t={t} /></div>}
                          {/* @ts-ignore react-window v2 */}
                          <List listRef={listRef} rowCount={flatItems.length} rowHeight={dynamicRowHeight} rowComponent={VirtualizedRow}
                                rowProps={{ flatItems, regenerateMessage, searchQuery, searchMatches, currentMatchIndex, dynamicRowHeight } as any}
                                overscanCount={5} style={{ height: containerHeight - (hasPinned ? 80 : 0), width: '100%' }} className="px-4" />
                          <div ref={messagesEndRef} />
                        </motion.div>
                    ) : (
                        <motion.div key="messages" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6 px-4 py-6">
                          {hasPinned && <PinnedSection messages={messages} t={t} />}
                          {messages.map((message, index) => {
                            const prevMessage = index > 0 ? messages[index - 1] : null
                            const showSeparator = shouldShowDateSeparator(prevMessage, message)
                            return (
                                <div key={message.id} className="animate-slide-up">
                                  {showSeparator && (
                                      <div className="flex items-center gap-3 py-3">
                                        <div className="flex-1 border-t border-muted-foreground/10" />
                                        <span className="text-[11px] text-muted-foreground/50 whitespace-nowrap">{formatDateSeparator(message.timestamp, t)}</span>
                                        <div className="flex-1 border-t border-muted-foreground/10" />
                                      </div>
                                  )}
                                  <MessageBubble message={message} onRegenerate={regenerateMessage} searchQuery={searchQuery} searchMatches={searchMatches} currentMatchIndex={currentMatchIndex} />
                                </div>
                            )
                          })}
                          <div ref={messagesEndRef} />
                        </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <AnimatePresence>
                {showScrollButton && (
                    <motion.div initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 10 }} transition={{ duration: 0.2 }} className="absolute bottom-16 right-6 z-10">
                      <Button size="icon" className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 scroll-to-bottom-btn" onClick={scrollToBottom} aria-label={t('chat.scrollToBottom')}><ArrowDown className="h-4 w-4" /></Button>
                    </motion.div>
                )}
              </AnimatePresence>
              <EnhancedFooter domainIcon={domainIcon} domainDisplayName={domainDisplayName} disclaimerText={disclaimerText} messageCount={messageCount} />
            </div>
            <ChatInput onSend={sendMessage} onStop={stopStreaming} isStreaming={isStreaming} onTyping={presence.emitTyping} onStopTyping={presence.emitStopTyping} />
          </div>
        </div>
        <ConversationStats />
        <SubscriptionDialog />
        <ActivateDialogWrapper />
      </ErrorBoundary>
  )
}

function VirtualizedRow({ index, style, flatItems, regenerateMessage, searchQuery, searchMatches, currentMatchIndex, dynamicRowHeight }: {
  readonly index: number
  readonly style: React.CSSProperties
  readonly flatItems: FlatItem[]
  readonly regenerateMessage?: () => void
  readonly searchQuery?: string
  readonly searchMatches?: Array<{ messageId: string; matchIndex: number }>
  readonly currentMatchIndex?: number
  readonly dynamicRowHeight: { getAverageRowHeight(): number; getRowHeight(index: number): number | undefined; setRowHeight(index: number, size: number): void; observeRowElements(elements: Element[] | NodeListOf<Element>): () => void }
}) {
  const item = flatItems[index]
  const rowRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    const el = rowRef.current
    if (el) { const d = dynamicRowHeight.observeRowElements([el]); return d }
  }, [dynamicRowHeight])

  if (!item) return null

  if (item.type === 'separator') {
    return (
        <div ref={rowRef} style={style} className="flex items-center gap-3">
          <div className="flex-1 border-t border-muted-foreground/10" />
          <span className="text-[11px] text-muted-foreground/50 whitespace-nowrap">{item.timestamp ? formatDateSeparator(item.timestamp, t) : item.separatorLabel}</span>
          <div className="flex-1 border-t border-muted-foreground/10" />
        </div>
    )
  }

  if (!item.message) return null

  return (
      <div ref={rowRef} style={style}>
        <MessageItem message={item.message} onRegenerate={regenerateMessage} searchQuery={searchQuery} searchMatches={searchMatches} currentMatchIndex={currentMatchIndex} />
      </div>
  )
}