'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Paperclip, Mic, X, Square, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatStore } from '../../stores/chat'
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
    const [voiceHint, setVoiceHint] = useState<string | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const recognitionRef = useRef<SpeechRecognition | null>(null)
    const uploadedImages = useChatStore((s) => s.uploadedImages)
    const addUploadedImage = useChatStore((s) => s.addUploadedImage)
    const removeUploadedImage = useChatStore((s) => s.removeUploadedImage)
    const clearImages = useChatStore((s) => s.clearImages)
    const currentDomain = useChatStore((s) => s.currentDomain)
    const { toast } = useToast()

    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const voiceHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const userStoppedRef = useRef(false)
    const inputRef = useRef(input)
    useEffect(() => { inputRef.current = input }, [input])
    const finalTranscriptRef = useRef('')
    const interimTranscriptRef = useRef('')

    const showVoiceHint = useCallback((message: string) => {
        setVoiceHint(message)
        if (voiceHintTimerRef.current) clearTimeout(voiceHintTimerRef.current)
        voiceHintTimerRef.current = setTimeout(() => setVoiceHint(null), 6000)
    }, [])

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop()
        }
        setIsListening(false)
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = null
        }
        if (!userStoppedRef.current && !finalTranscriptRef.current.trim() && !inputRef.current.trim()) {
            showVoiceHint('未检测到语音，请点击按钮后开始说话')
        }
        userStoppedRef.current = true
        interimTranscriptRef.current = ''
    }, [showVoiceHint])

    const startListening = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!SpeechRecognition) {
            showVoiceHint('您的浏览器不支持语音输入')
            return
        }

        const recognition = new SpeechRecognition()
        recognition.lang = 'zh-CN'
        recognition.continuous = true
        recognition.interimResults = true

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current)
                silenceTimerRef.current = null
            }

            let newFinal = ''
            let newInterim = ''
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i]
                if (result.isFinal) {
                    newFinal += result[0].transcript
                } else {
                    newInterim += result[0].transcript
                }
            }

            if (newFinal) {
                const current = finalTranscriptRef.current
                if (!current.endsWith(newFinal)) {
                    finalTranscriptRef.current = current + newFinal
                }
                interimTranscriptRef.current = ''
            }

            if (newInterim) {
                interimTranscriptRef.current = newInterim
            }

            setInput(finalTranscriptRef.current + interimTranscriptRef.current)
            if (textareaRef.current) {
                textareaRef.current.focus()
            }

            // 每次收到结果后重置静默定时器：2.5 秒内无新结果则自动停止
            silenceTimerRef.current = setTimeout(() => {
                stopListening()
            }, 2500)
        }

        recognition.onerror = (event: Event) => {
            const errorMsg = (event as any)?.error || 'unknown'
            console.warn('[Voice] 识别错误:', errorMsg)
            if (errorMsg === 'aborted' || errorMsg === 'no-speech') return
            if (errorMsg === 'not-allowed') {
                showVoiceHint('麦克风权限未开启，请在浏览器设置中允许访问麦克风')
                stopListening()
            } else {
                showVoiceHint('语音识别失败，请重试')
                stopListening()
            }
        }

        recognition.onend = () => {
            if (userStoppedRef.current) return

            const savedText = finalTranscriptRef.current + interimTranscriptRef.current

            try {
                recognition.start()
                finalTranscriptRef.current = savedText
                interimTranscriptRef.current = ''
                setInput(savedText)
                if (textareaRef.current) {
                    textareaRef.current.focus()
                }
                // 重启后启动静默定时器，防止无限运行
                silenceTimerRef.current = setTimeout(() => {
                    stopListening()
                }, 2500)
            } catch {
                stopListening()
            }
        }

        recognitionRef.current = recognition

        try {
            recognition.start()
            setIsListening(true)
            userStoppedRef.current = false
            finalTranscriptRef.current = input || ''
            interimTranscriptRef.current = ''
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current)
                silenceTimerRef.current = null
            }
            setVoiceHint(null)

            // 启动静默定时器，不说话 2.5 秒自动停止
            silenceTimerRef.current = setTimeout(() => {
                stopListening()
            }, 2500)
        } catch (e) {
            console.error('[Voice] start 异常:', e)
            showVoiceHint('语音识别启动失败，请重试')
        }
    }, [showVoiceHint, stopListening, input])

    const toggleVoiceInput = useCallback(() => {
        if (isListening) {
            stopListening()
        } else {
            startListening()
        }
    }, [isListening, startListening, stopListening])

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

    const canSend = input.trim().length > 0 || uploadedImages.length > 0

    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop()
            }
        }
    }, [])

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

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 flex-shrink-0 transition-all ${
                                    isListening
                                        ? 'text-primary bg-primary/10 ring-2 ring-primary/20 animate-pulse'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                                onClick={toggleVoiceInput}
                                disabled={isStreaming}
                                aria-label={isListening ? t('chat.stopVoice') : t('chat.voiceInput')}
                            >
                                <Mic className="h-4 w-4" />
                            </Button>
                            <AnimatePresence>
                                {voiceHint && (
                                    <motion.span
                                        initial={{ opacity: 0, x: -4 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -4 }}
                                        transition={{ duration: 0.2 }}
                                        className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] text-primary/70 whitespace-nowrap"
                                    >
                                        <Mic className="h-2.5 w-2.5 flex-shrink-0" />
                                        <span>{voiceHint}</span>
                                        <button
                                            onClick={() => setVoiceHint(null)}
                                            className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-primary/30 hover:text-primary/60 transition-colors"
                                        >
                                            <X className="h-2 w-2" />
                                        </button>
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>

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