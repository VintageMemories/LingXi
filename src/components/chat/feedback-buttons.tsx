'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { useChatStore } from '@/stores/chat-store'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/lib/i18n'

interface FeedbackButtonsProps {
  messageId: string
  sessionId: string | null
  currentFeedback?: 1 | -1 | null
  responseText?: string
}

export function FeedbackButtons({
                                  messageId,
                                  sessionId,
                                  currentFeedback,
                                  responseText,
                                }: FeedbackButtonsProps) {
  const { t } = useTranslation()
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const updateMessage = useChatStore((s) => s.updateMessage)
  const { toast } = useToast()

  const handleFeedback = async (rating: 1 | -1) => {
    // Toggle off if same rating
    if (currentFeedback === rating) {
      updateMessage(messageId, { feedback: null })
      return
    }

    updateMessage(messageId, { feedback: rating })
    setIsSubmitting(true)

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message_id: messageId,
          rating,
          comment: comment || undefined,
          response: responseText,
        }),
      })
    } catch {
      // Silently fail - feedback is not critical
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitComment = async (rating: 1 | -1) => {
    if (!comment.trim()) {
      handleFeedback(rating)
      return
    }
    updateMessage(messageId, { feedback: rating })
    setIsSubmitting(true)

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message_id: messageId,
          rating,
          comment: comment.trim(),
          response: responseText,
        }),
      })
      toast({ title: t('feedback.thankYou') })
      setComment('')
    } catch {
      // Silently fail
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
      <div className="mt-1.5 flex items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 rounded-md ${
                    currentFeedback === 1
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                }`}
                disabled={isSubmitting}
                onClick={(e) => e.stopPropagation()}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" side="top">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t('feedback.helpfulQuestion')}</p>
              <Textarea
                  placeholder={t('feedback.improvementPlaceholder')}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[60px] text-xs"
              />
              <Button
                  size="sm"
                  className="w-full"
                  onClick={() => handleSubmitComment(1)}
                  disabled={isSubmitting}
              >
                {t('feedback.submitFeedback')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 rounded-md ${
                    currentFeedback === -1
                        ? 'bg-destructive/10 text-destructive'
                        : 'text-muted-foreground hover:text-foreground'
                }`}
                disabled={isSubmitting}
                onClick={(e) => e.stopPropagation()}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" side="top">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t('feedback.improvementQuestion')}</p>
              <Textarea
                  placeholder={t('feedback.improvementPlaceholder2')}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[60px] text-xs"
              />
              <Button
                  size="sm"
                  variant="destructive"
                  className="w-full"
                  onClick={() => handleSubmitComment(-1)}
                  disabled={isSubmitting}
              >
                {t('feedback.submitFeedback')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
  )
}