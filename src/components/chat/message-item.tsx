'use client'

import { useRef, useCallback, useEffect } from 'react'
import { MessageBubble } from './message-bubble'
import type { ChatMessage } from '@/stores/chat-store'

interface MessageItemProps {
  message: ChatMessage
  onRegenerate?: () => void
  searchQuery?: string
  searchMatches?: Array<{ messageId: string; matchIndex: number }>
  currentMatchIndex?: number
  showSeparator?: boolean
  separatorLabel?: string
  onHeightChange?: (id: string, height: number) => void
}

export function MessageItem({
                              message,
                              onRegenerate,
                              searchQuery,
                              searchMatches,
                              currentMatchIndex,
                              showSeparator,
                              separatorLabel,
                              onHeightChange,
                            }: MessageItemProps) {
  const itemRef = useRef<HTMLDivElement>(null)

  const measureHeight = useCallback(() => {
    if (itemRef.current && onHeightChange) {
      const height = itemRef.current.getBoundingClientRect().height
      onHeightChange(message.id, height)
    }
  }, [message.id, onHeightChange])

  useEffect(() => {
    measureHeight()

    const observer = new ResizeObserver(() => {
      measureHeight()
    })

    if (itemRef.current) {
      observer.observe(itemRef.current)
    }

    return () => observer.disconnect()
  }, [measureHeight])

  return (
      <div ref={itemRef} className="animate-slide-up">
        {showSeparator && separatorLabel && (
            <div className="flex items-center gap-3 py-3">
              <div className="flex-1 border-t border-muted-foreground/10" />
              <span className="text-[11px] text-muted-foreground/50 whitespace-nowrap">
            {separatorLabel}
          </span>
              <div className="flex-1 border-t border-muted-foreground/10" />
            </div>
        )}
        <MessageBubble
            message={message}
            onRegenerate={onRegenerate}
            searchQuery={searchQuery}
            searchMatches={searchMatches}
            currentMatchIndex={currentMatchIndex}
        />
      </div>
  )
}