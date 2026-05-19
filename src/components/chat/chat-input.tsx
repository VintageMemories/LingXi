'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// 扩展浏览器语音识别类型
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList
}
interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    onresult: (event: SpeechRecognitionEvent) => void
    onerror: (event: Event) => void
    onend: () => void
    start(): void
    stop(): void
}
declare global {
    interface Window {
        SpeechRecognition?: new () => SpeechRecognition
        webkitSpeechRecognition?: new () => SpeechRecognition
    }
}
import { Send, Paperclip, Mic, MicOff, X, Square, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/stores/chat-store'
import { useTranslation } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatInputProps {
  onSend: (message: string, images?: string[]) => void
  onStop: () => void
  isStreaming: boolean
  onTyping?: () => void
  onStopTyping?: () => void
}

const MAX_CHARS = 2000

const promptSuggestionKeys: Record<string, { icon: string; textKey: string }[]> = {
  medical: [
    { icon: '🩺', textKey: 'chat.analyzeSymptoms' },
    { icon: '💊', textKey: 'chat.queryDrug' },
    { icon: '📋', textKey: 'chat.interpretReport' },
    { icon: '🏥', textKey: 'chat.recommendDepartment' },
  ],
  legal: [
    { icon: '⚖️', textKey: 'chat.contractReview' },
    { icon: '📝', textKey: 'chat.laborDispute' },
    { icon: '🏛️', textKey: 'chat.legalAdvice' },
    { icon: '📑', textKey: 'chat.lawSearch' },
  ],
  finance: [
    { icon: '💰', textKey: 'chat.investmentAdvice' },
    { icon: '📊', textKey: 'chat.marketAnalysis' },
    { icon: '🏦', textKey: 'chat.riskAssessment' },
    { icon: '📈', textKey: 'chat.financePlan' },
  ],
}

export function ChatInput({ onSend, onStop, isStreaming, onTyping, onStopTyping }: ChatInputProps) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<unknown>(null)
  const uploadedImages = useChatStore((s) => s.uploadedImages)
  const addUploadedImage = useChatStore((s) => s.addUploadedImage)
  const removeUploadedImage = useChatStore((s) => s.removeUploadedImage)
  const clearImages = useChatStore((s) => s.clearImages)
  const currentDomain = useChatStore((s) => s.currentDomain)
  const { toast } = useToast()

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    if (onTyping) {
      onTyping()
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        if (onStopTyping) onStopTyping()
      }, 2000)
    }
  }, [onTyping, onStopTyping])

  const charCount = input.length
  const showCharCount = charCount > 500
  const showPrompts = isFocused && !input.trim() && !isStreaming

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px'
    }
  }, [input])

  const handleSend = useCallback(() => {
    if (!input.trim() && uploadedImages.length === 0) return
    if (isStreaming) return

    onSend(input, uploadedImages.length > 0 ? uploadedImages : undefined)
    setInput('')
    clearImages()
    setIsFocused(false)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [input, uploadedImages, isStreaming, onSend, clearImages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast({ title: t('chat.imageOnly'), variant: 'destructive' })
        continue
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({ title: t('chat.imageSizeLimit'), variant: 'destructive' })
        continue
      }

      try {
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = reader.result as string
          addUploadedImage(base64)
        }
        reader.readAsDataURL(file)
      } catch {
        toast({ title: t('chat.imageReadFailed'), variant: 'destructive' })
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const toggleVoiceInput = useCallback(() => {
    if (isListening) {
      const recognition = recognitionRef.current as { stop: () => void } | null
      if (recognition) {
        recognition.stop()
      }
      setIsListening(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      toast({ title: t('chat.voiceNotSupported'), variant: 'destructive' })
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = event.results
      const lastResult = results[results.length - 1]
      if (lastResult.isFinal) {
        setInput((prev) => {
          const newInput = prev + lastResult[0].transcript
          return newInput
        })
        setIsListening(false)
      }
    }

    recognition.onerror = () => {
      setIsListening(false)
      toast({ title: t('chat.voiceFailed'), variant: 'destructive' })
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening, toast, t])

  const canSend = input.trim().length > 0 || uploadedImages.length > 0

  return (
      <div className="border-t bg-background/80 backdrop-blur-lg">
        <div className="mx-auto max-w-4xl px-4 pb-3 pt-3">
          <AnimatePresence>
            {uploadedImages.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-2 flex flex-wrap gap-2"
                >
                  {uploadedImages.map((img, idx) => (
                      <motion.div
                          key={idx}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="group relative h-16 w-16 overflow-hidden rounded-lg border shadow-sm"
                      >
                        <img
                            src={img}
                            alt={t('chat.uploadedImageAlt', { index: idx + 1 })}
                            className="h-full w-full object-cover"
                        />
                        <button
                            onClick={() => removeUploadedImage(idx)}
                            className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </motion.div>
                  ))}
                </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showPrompts && (
                <motion.div
                    initial={{ opacity: 0, y: 8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: 8, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mb-2 flex flex-wrap gap-1.5"
                >
                  {(promptSuggestionKeys[currentDomain?.id || 'medical'] || promptSuggestionKeys.medical).map((prompt, idx) => (
                      <motion.button
                          key={prompt.textKey}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => {
                            setInput(t(prompt.textKey))
                            textareaRef.current?.focus()
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/10 bg-primary/5 px-2.5 py-1 text-xs text-primary/70 transition-all hover:border-primary/20 hover:bg-primary/10 hover:text-primary active:scale-95"
                      >
                        <span>{prompt.icon}</span>
                        {t(prompt.textKey)}
                      </motion.button>
                  ))}
                </motion.div>
            )}
          </AnimatePresence>

          <div className="chat-input-container">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
            />

            <div className="relative px-4 pt-3 pb-2">
            <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={t('chat.askPlaceholder', { name: currentDomain?.name || '灵析' })}
                rows={1}
                maxLength={MAX_CHARS}
                className="max-h-32 min-h-[36px] w-full resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none"
                disabled={isStreaming}
            />
              {!input && !isFocused && (
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Sparkles className="h-4 w-4 text-muted-foreground/20" />
                  </div>
              )}
              {isListening && (
                  <div className="absolute right-6 top-4">
                <span className="flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                  </div>
              )}
            </div>

            <div className="input-toolbar-separator mx-3" />

            <div className="flex items-center gap-1 px-2 py-1.5">
              <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming}
                  aria-label={t('chat.uploadImage')}
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 flex-shrink-0 transition-all ${
                      isListening
                          ? 'text-primary bg-primary/10 ring-2 ring-primary/20'
                          : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={toggleVoiceInput}
                  disabled={isStreaming}
                  aria-label={isListening ? t('chat.stopVoice') : t('chat.voiceInput')}
              >
                {isListening ? (
                    <MicOff className="h-4 w-4" />
                ) : (
                    <Mic className="h-4 w-4" />
                )}
              </Button>

              <div className="flex-1" />

              <AnimatePresence>
                {showCharCount && (
                    <motion.span
                        initial={{ opacity: 0, x: 4 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 4 }}
                        className={`text-[10px] mr-1 ${
                            charCount > MAX_CHARS * 0.9
                                ? 'text-destructive'
                                : 'text-muted-foreground/50'
                        }`}
                    >
                      {charCount}/{MAX_CHARS}
                    </motion.span>
                )}
              </AnimatePresence>

              {isStreaming ? (
                  <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 transition-all"
                      onClick={onStop}
                      aria-label={t('chat.stopGenerating')}
                  >
                    <Square className="h-3.5 w-3.5" />
                  </Button>
              ) : (
                  <Button
                      size="icon"
                      className={`h-8 w-8 flex-shrink-0 rounded-lg transition-all duration-200 ${
                          canSend
                              ? 'bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30'
                              : 'bg-primary/50 text-primary-foreground/50'
                      }`}
                      onClick={handleSend}
                      disabled={!canSend}
                      aria-label={t('chat.send')}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
              )}
            </div>
          </div>

          <div className="mt-1.5 flex items-center justify-center gap-3 text-[10px] text-muted-foreground/40">
            <span>{t('chat.enterToSend')}</span>
            <span>·</span>
            <span>{t('chat.shiftEnterNewline')}</span>
          </div>
        </div>
      </div>
  )
}