'use client'

import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useChatStore, type ChatMessage } from '@/stores/chat-store'
import { useTranslation } from '@/lib/i18n'
import { SourceReference } from './source-reference'
import { FeedbackButtons } from './feedback-buttons'
import { TypingIndicator } from './typing-indicator'
import { Copy, Check, Bot, RefreshCw, Pin, PinOff, Volume2, VolumeX } from 'lucide-react'
import { useState, useCallback, useMemo, useRef, useEffect, type ReactNode } from 'react'
import { useToast } from '@/hooks/use-toast'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import 'highlight.js/styles/github-dark.css'

interface MessageBubbleProps {
  message: ChatMessage
  onRegenerate?: () => void
  searchQuery?: string
  searchMatches?: Array<{ messageId: string; matchIndex: number }>
  currentMatchIndex?: number
}

const intentKeys: Record<string, string> = {
  emergency: 'intents.emergency',
  symptom: 'intents.symptom',
  drug_query: 'intents.drug_query',
  checkup: 'intents.checkup',
  appointment: 'intents.appointment',
  department: 'intents.department',
  greeting: 'intents.greeting',
  follow_up: 'intents.follow_up',
  medical_query: 'intents.medical_query',
  legal_query: 'intents.legal_query',
  contract_review: 'intents.contract_review',
  labor_dispute: 'intents.labor_dispute',
  property_dispute: 'intents.property_dispute',
  criminal_defense: 'intents.criminal_defense',
  finance_query: 'intents.finance_query',
  investment: 'intents.investment',
  insurance: 'intents.insurance',
  out_of_scope: 'intents.out_of_scope',
  blocked: 'intents.blocked',
}

function CodeBlock({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { className?: string }) {
  const { t } = useTranslation()
  const codeRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)
  const lang = className?.replace('language-', '') || ''

  useEffect(() => {
    if (codeRef.current && lang) {
      try {
        hljs.highlightElement(codeRef.current)
      } catch {
        // Ignore highlight errors
      }
    }
  }, [lang, children])

  const handleCopy = async () => {
    const text = String(children).replace(/\n$/, '')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
      <div className="relative group/code">
        {lang && (
            <div className="absolute top-2 right-12 z-10">
              <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4 bg-muted/80 text-muted-foreground">
                {lang}
              </Badge>
            </div>
        )}
        <button
            onClick={handleCopy}
            className="absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-muted/80 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/code:opacity-100"
            aria-label={t('messages.copy')}
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        </button>
        <code ref={codeRef} className={`${className || ''} hljs`} {...props}>
          {children}
        </code>
      </div>
  )
}

const markdownComponents: Components = {
  pre: ({ children }) => (
      <pre className="markdown-pre overflow-x-auto rounded-lg border border-border/40 bg-muted/60 p-4 text-sm leading-relaxed">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith('language-')
    if (isBlock) {
      return (
          <CodeBlock className={className} {...props}>
            {children}
          </CodeBlock>
      )
    }
    return (
        <code className="markdown-inline-code rounded bg-muted/80 px-1.5 py-0.5 text-[0.875em] font-mono" {...props}>
          {children}
        </code>
    )
  },
  table: ({ children }) => (
      <div className="markdown-table-wrapper my-2 overflow-x-auto">
        <table className="markdown-table w-full">{children}</table>
      </div>
  ),
  thead: ({ children }) => (
      <thead className="border-b border-border/50 bg-muted/40">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
      <tr className="border-b border-border/30 transition-colors hover:bg-muted/20">{children}</tr>
  ),
  th: ({ children }) => (
      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </th>
  ),
  td: ({ children }) => (
      <td className="px-3 py-2 text-sm">{children}</td>
  ),
  a: ({ href, children }) => (
      <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
      >
        {children}
      </a>
  ),
  hr: () => <hr className="markdown-hr my-4 border-0" />,
  blockquote: ({ children }) => (
      <blockquote className="markdown-blockquote my-2 border-l-3 border-primary/50 pl-4 text-muted-foreground italic">
        {children}
      </blockquote>
  ),
  ul: ({ children, depth }: { children?: ReactNode; depth?: number }) => (
      <ul className={`markdown-list ${depth && depth > 0 ? 'mt-1' : 'my-1.5'} list-disc pl-5 space-y-0.5`}>
        {children}
      </ul>
  ),
  ol: ({ children, depth }: { children?: ReactNode; depth?: number }) => (
      <ol className={`markdown-list ${depth && depth > 0 ? 'mt-1' : 'my-1.5'} list-decimal pl-5 space-y-0.5`}>
        {children}
      </ol>
  ),
}

export function MessageBubble({ message, onRegenerate, searchQuery, searchMatches, currentMatchIndex }: MessageBubbleProps) {
  const { t } = useTranslation()
  const currentDomain = useChatStore((s) => s.currentDomain)
  const sessionId = useChatStore((s) => s.sessionId)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const settings = useChatStore((s) => s.settings)
  const togglePin = useChatStore((s) => s.togglePin)
  const user = useChatStore((s) => s.user)
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isTTSPlaying, setIsTTSPlaying] = useState(false)
  const { toast } = useToast()

  const handleTTS = useCallback(() => {
    if (isTTSPlaying) {
      window.speechSynthesis.cancel()
      setIsTTSPlaying(false)
      return
    }

    const textToRead = message.content.length > 2000
        ? message.content.slice(0, 2000) + '...'
        : message.content

    if (!textToRead.trim()) return

    const utterance = new SpeechSynthesisUtterance(textToRead)
    utterance.lang = 'zh-CN'
    utterance.rate = 1.0
    utterance.onstart = () => setIsTTSPlaying(true)
    utterance.onend = () => setIsTTSPlaying(false)
    utterance.onerror = () => {
      setIsTTSPlaying(false)
      toast({ title: t('messages.ttsFailed'), description: t('messages.ttsRetryLater') })
    }

    window.speechSynthesis.speak(utterance)
  }, [message.content, isTTSPlaying, toast, t])

  const isSearchActive = searchQuery && searchQuery.trim().length > 0

  const highlightedContent = useMemo(() => {
    if (!isSearchActive || !searchQuery) return message.content

    const lowerContent = message.content.toLowerCase()
    const lowerQuery = searchQuery.toLowerCase()
    const parts: Array<{ text: string; isHighlight: boolean; isCurrentMatch: boolean }> = []

    const thisMsgMatches = (searchMatches || [])
        .filter(m => m.messageId === message.id)
        .map(m => m.matchIndex)
        .sort((a, b) => a - b)

    if (thisMsgMatches.length === 0) return message.content

    let lastEnd = 0
    for (const startIdx of thisMsgMatches) {
      if (startIdx < lastEnd) continue
      if (startIdx > lastEnd) {
        parts.push({ text: message.content.slice(lastEnd, startIdx), isHighlight: false, isCurrentMatch: false })
      }
      const globalMatchIdx = (searchMatches || []).findIndex(
          m => m.messageId === message.id && m.matchIndex === startIdx
      )
      const isCurrent = globalMatchIdx === currentMatchIndex
      parts.push({
        text: message.content.slice(startIdx, startIdx + searchQuery.length),
        isHighlight: true,
        isCurrentMatch: isCurrent,
      })
      lastEnd = startIdx + searchQuery.length
    }
    if (lastEnd < message.content.length) {
      parts.push({ text: message.content.slice(lastEnd), isHighlight: false, isCurrentMatch: false })
    }

    return parts
  }, [message.id, message.content, searchQuery, searchMatches, currentMatchIndex, isSearchActive])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = useCallback(() => {
    if (!onRegenerate || isStreaming) return
    setIsRegenerating(true)
    onRegenerate()
    setTimeout(() => setIsRegenerating(false), 1000)
  }, [onRegenerate, isStreaming])

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
      <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className={`flex gap-3 message-hover-glow ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
          data-message-id={message.id}
      >
        {/* Avatar */}
        <div className="flex flex-col items-center gap-1">
          <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
            {isUser && user?.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
            <AvatarFallback
                className={
                  isUser
                      ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground text-xs font-medium'
                      : 'bg-gradient-to-br from-primary/20 to-primary/10 text-sm'
                }
            >
              {isUser ? t('messages.me') : currentDomain?.icon || '🤖'}
            </AvatarFallback>
          </Avatar>
          {!isUser && (
              <Badge
                  variant="outline"
                  className="mt-0.5 gap-0.5 border-primary/20 bg-primary/5 px-1 py-0 text-[8px] font-normal text-primary/70"
              >
                <Bot className="h-2 w-2" />
                AI
              </Badge>
          )}
        </div>

        {/* Message Content */}
        <div
            className={`group/msg max-w-[80%] min-w-0 sm:max-w-[70%] ${
                isUser ? 'items-end' : 'items-start'
            }`}
        >
          {message.statusBadges && message.statusBadges.length > 0 && message.isStreaming && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {message.statusBadges.map((badge, idx) => (
                    <Badge
                        key={idx}
                        variant="secondary"
                        className="gap-1 text-[10px] font-normal"
                    >
                      {badge.type === 'tool_start' ? '🔧' : '🔍'}
                      {badge.message}
                    </Badge>
                ))}
              </div>
          )}

          <motion.div
              whileHover={!isUser ? { scale: 1.01 } : undefined}
              transition={{ duration: 0.15 }}
              className={`message-enter rounded-2xl px-4 py-3 text-sm leading-relaxed relative ${
                  isUser
                      ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-tr-sm shadow-md shadow-primary/20 inner-shadow-depth'
                      : 'message-glow border border-border/50 bg-card text-card-foreground rounded-tl-sm shadow-sm hover:shadow-md transition-shadow border-l-2 border-l-primary/30'
              }`}
              style={!isUser ? {
                borderImage: 'linear-gradient(to bottom, oklch(0.6 0.15 170), oklch(0.6 0.08 170 / 0.3)) 1',
                borderImageSlice: '0 0 0 1',
              } : undefined}
          >
            {!isUser && message.pinned && (
                <div className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white shadow-md z-10">
                  <Pin className="h-2.5 w-2.5" />
                </div>
            )}

            {message.isStreaming && !message.content ? (
                <TypingIndicator />
            ) : isSearchActive && typeof highlightedContent !== 'string' ? (
                <div className="markdown-body">
                  {highlightedContent.map((part, idx) =>
                      part.isHighlight ? (
                          <mark
                              key={idx}
                              className={`search-highlight ${part.isCurrentMatch ? 'search-highlight-current' : ''} rounded-sm px-0.5`}
                          >
                            {part.text}
                          </mark>
                      ) : (
                          <span key={idx}>{part.text}</span>
                      )
                  )}
                </div>
            ) : (
                <div className="markdown-body">
                  <ReactMarkdown components={markdownComponents}>
                    {message.content}
                  </ReactMarkdown>
                </div>
            )}

            {message.isStreaming && message.content && (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary" />
            )}

            {isTTSPlaying && !isUser && (
                <div className="mt-2 flex items-center gap-1">
                  <span className="tts-wave-bar" style={{ height: 3 }} />
                  <span className="tts-wave-bar" style={{ height: 6 }} />
                  <span className="tts-wave-bar" style={{ height: 4 }} />
                  <span className="tts-wave-bar" style={{ height: 3 }} />
                  <span className="tts-wave-bar" style={{ height: 6 }} />
                  <span className="ml-1.5 text-[10px] text-primary/70">{t('messages.readingAloud')}</span>
                </div>
            )}
          </motion.div>

          {!isUser && !message.isStreaming && message.content && (
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-1.5 text-[10px] text-muted-foreground/40">
                  <span>~{message.content.length}{t('messages.characters')}</span>
                  <span>·</span>
                  <span>~{Math.max(1, Math.ceil(message.content.length / 400))}{t('messages.minuteRead')}</span>
                </div>

                <div className="flex items-center gap-0.5 rounded-full bg-muted/60 backdrop-blur-sm border border-border/30 px-1.5 py-0.5 opacity-0 translate-y-1 transition-all duration-200 group-hover/msg:opacity-100 group-hover/msg:translate-y-0">
                  {settings.showIntent && message.intent && (
                      <Badge
                          variant="outline"
                          className="text-[10px] font-normal border-0 bg-primary/10 text-primary/80 px-1.5 py-0 h-5 rounded-full"
                      >
                        {intentKeys[message.intent] ? t(intentKeys[message.intent]) : message.intent}
                      </Badge>
                  )}

                  {settings.showIntent && message.intent && (
                      <div className="w-px h-3 bg-border/40 mx-0.5" />
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={handleCopy}
                      >
                        {copied ? (
                            <Check className="h-3 w-3 text-primary" />
                        ) : (
                            <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{copied ? t('messages.copied') : t('messages.copy')}</p>
                    </TooltipContent>
                  </Tooltip>

                  {onRegenerate && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={handleRegenerate}
                              disabled={isRegenerating || isStreaming}
                          >
                            <RefreshCw className={`h-3 w-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>{t('messages.regenerate')}</p>
                        </TooltipContent>
                      </Tooltip>
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                          variant="ghost"
                          size="icon"
                          className={`h-6 w-6 rounded-full ${message.pinned ? 'text-amber-500 bg-amber-500/10' : 'text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10'}`}
                          onClick={() => {
                            togglePin(message.id)
                            toast({ title: message.pinned ? t('messages.unpinned') : t('messages.pinned') })
                          }}
                      >
                        {message.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{message.pinned ? t('messages.unpin') : t('messages.pin')}</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                          variant="ghost"
                          size="icon"
                          className={`h-6 w-6 rounded-full ${isTTSPlaying ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'}`}
                          onClick={handleTTS}
                      >
                        {isTTSPlaying ? (
                            <div className="relative">
                              <VolumeX className="h-3 w-3" />
                              <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                        </span>
                            </div>
                        ) : (
                            <Volume2 className="h-3 w-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{isTTSPlaying ? t('messages.stopReading') : t('messages.readAloud')}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {settings.showSources && (
                      <SourceReference
                          sources={message.sources || []}
                          sourceHint={message.sourceHint}
                      />
                  )}
                  <FeedbackButtons
                      messageId={message.id}
                      sessionId={sessionId}
                      currentFeedback={message.feedback}
                      responseText={message.content}
                  />
                </div>
              </div>
          )}

          <div
              className={`mt-1 text-[10px] text-muted-foreground/60 ${
                  isUser ? 'text-right' : 'text-left'
              }`}
          >
            {formatTime(message.timestamp)}
          </div>
        </div>
      </motion.div>
  )
}