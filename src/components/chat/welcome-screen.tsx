'use client'

import { motion } from 'framer-motion'
import { useChatStore, type SessionInfo } from '@/stores/chat-store'
import { MessageCircle, Clock, ArrowRight } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { useEffect, useState, useRef } from 'react'

interface WelcomeScreenProps {
    onSuggestionClick: (text: string) => void
}

const domainCapabilityKeys: Record<string, Array<{ icon: string; labelKey: string }>> = {
    medical: [
        { icon: '🔍', labelKey: 'welcome.ragSearch' },
        { icon: '🩺', labelKey: 'welcome.symptomAnalysis' },
        { icon: '💊', labelKey: 'welcome.drugQuery' },
    ],
    legal: [
        { icon: '🔍', labelKey: 'welcome.lawSearch' },
        { icon: '📋', labelKey: 'welcome.contractReview' },
        { icon: '⚖️', labelKey: 'welcome.rightsProtection' },
    ],
    finance: [
        { icon: '🔍', labelKey: 'welcome.marketAnalysis' },
        { icon: '📊', labelKey: 'welcome.riskAssessment' },
        { icon: '💡', labelKey: 'welcome.investmentAdvice' },
    ],
}

const defaultCapabilityKeys = [
    { icon: '🔍', labelKey: 'welcome.ragSearch' },
    { icon: '🤖', labelKey: 'welcome.smartAnalysis' },
    { icon: '📚', labelKey: 'welcome.professionalKnowledge' },
]

const domainDisplayNameKeys: Record<string, string> = {
    medical: 'welcome.medicalShort',
    legal: 'welcome.legalShort',
    finance: 'welcome.financeShort',
}

interface KnowledgeStats {
    total: number
    byDomain: Record<string, number>
}

function useAnimatedCounter(target: number, duration: number = 1500) {
    const [count, setCount] = useState(0)
    const prevTargetRef = useRef(0)

    useEffect(() => {
        const start = prevTargetRef.current
        const end = target
        const startTime = Date.now()

        const animate = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.round(start + (end - start) * eased))

            if (progress < 1) {
                requestAnimationFrame(animate)
            }
        }

        requestAnimationFrame(animate)
        prevTargetRef.current = target

        return () => {
            prevTargetRef.current = end
        }
    }, [target, duration])

    return count
}

function getRelativeTime(dateStr: string, t: (key: string, params?: Record<string, string | number>) => string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return t('sidebar.justNow')
    if (diffMins < 60) return t('sidebar.minutesAgo', { count: diffMins })
    if (diffHours < 24) return t('sidebar.hoursAgo', { count: diffHours })
    if (diffDays < 7) return t('sidebar.daysAgo', { count: diffDays })
    return t('sidebar.weeksAgo', { count: Math.floor(diffDays / 7) })
}

export function WelcomeScreen({ onSuggestionClick }: WelcomeScreenProps) {
    const { t } = useTranslation()
    const currentDomain = useChatStore((s) => s.currentDomain)
    const sessions = useChatStore((s) => s.sessions)
    const [stats, setStats] = useState<KnowledgeStats>({ total: 0, byDomain: {} })

    useEffect(() => {
        async function fetchStats() {
            try {
                const res = await fetch('/api/stats')
                if (res.ok) {
                    const data = await res.json()
                    setStats(data)
                }
            } catch {
                // Ignore fetch errors
            }
        }
        fetchStats()
    }, [])

    const animatedCount = useAnimatedCounter(stats.total || 228, 1500)

    const welcome = currentDomain?.welcome || {
        title: t('welcome.title'),
        subtitle: t('welcome.subtitle'),
        suggestions: [t('chat.askPlaceholder', { name: '🤖' }), t('chat.send'), t('chat.scrollToBottom'), t('settings.data')],
    }

    const capabilityKeys = currentDomain?.id
        ? domainCapabilityKeys[currentDomain.id] || defaultCapabilityKeys
        : defaultCapabilityKeys
    const capabilityBadges = capabilityKeys.map(b => ({ icon: b.icon, label: t(b.labelKey) }))

    const domainCountParts: string[] = []
    for (const [domain, count] of Object.entries(stats.byDomain)) {
        const nameKey = domainDisplayNameKeys[domain]
        const name = nameKey ? t(nameKey) : domain
        domainCountParts.push(`${name} ${count}`)
    }
    const domainCountText = domainCountParts.length > 0
        ? domainCountParts.join(' · ')
        : ''

    const recentSessions = sessions.slice(0, 3)

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative flex flex-col items-center justify-center px-4 py-12"
        >
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="particle-dots" />
                <div className="absolute inset-0 animate-bg-pattern" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
            </div>

            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="relative mb-8 z-10"
            >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 animate-gradient-shift blur-xl scale-150" />
                <div className="absolute inset-[-6px] rounded-2xl border-2 border-primary/30 animate-ring-pulse" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg animate-float">
                    {currentDomain?.icon ? (
                        <span className="text-4xl">{currentDomain.icon}</span>
                    ) : (
                        <MessageCircle className="h-10 w-10 text-primary" />
                    )}
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-primary/40 animate-pulse-online" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-primary shadow-sm" />
                    </span>
                </div>
            </motion.div>

            <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="mb-1 text-2xl font-bold sm:text-3xl z-10"
            >
                {welcome.title}
            </motion.h1>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
                className="mb-2 text-center z-10"
            >
                <p className="text-sm text-muted-foreground">
                    {t('welcome.quickStart')} · {t('welcome.knowledgeCount', { count: animatedCount })}
                </p>
                {domainCountText && (
                    <p className="mt-1 text-xs text-muted-foreground/60">
                        {domainCountText}
                    </p>
                )}
            </motion.div>

            <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="mb-4 text-center text-muted-foreground z-10"
            >
                {welcome.subtitle}
            </motion.p>

            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.4 }}
                className="mb-6 flex items-center gap-2 z-10"
            >
                {capabilityBadges.map((badge, index) => (
                    <motion.span
                        key={badge.label}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 + index * 0.08, duration: 0.3 }}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs text-primary/80 transition-all hover:border-primary/30 hover:bg-primary/10"
                    >
                        <span>{badge.icon}</span>
                        {badge.label}
                    </motion.span>
                ))}
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2 z-10"
            >
                {welcome.suggestions.map((suggestion, index) => (
                    <motion.button
                        key={suggestion}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + index * 0.08, duration: 0.3 }}
                        onClick={() => onSuggestionClick(suggestion)}
                        className="group relative flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-left text-sm transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/10 active:scale-[0.98] overflow-hidden"
                    >
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs text-primary transition-colors group-hover:bg-primary/20">
                            💬
                        </span>
                        <span className="relative text-foreground/80 group-hover:text-foreground">
                            {suggestion}
                        </span>
                        <ArrowRight className="absolute right-3 h-3.5 w-3.5 text-primary/0 group-hover:text-primary/50 transition-all duration-300 group-hover:translate-x-0 -translate-x-1" />
                    </motion.button>
                ))}
            </motion.div>

            {recentSessions.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    className="mt-6 w-full max-w-lg z-10"
                >
                    <div className="flex items-center gap-1.5 mb-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <span className="text-[11px] text-muted-foreground/50">{t('welcome.recentConversations')}</span>
                    </div>
                    <div className="space-y-1">
                        {recentSessions.map((session) => (
                            <button
                                key={session.id}
                                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-all hover:bg-muted/50 group"
                                onClick={() => {
                                    useChatStore.getState().loadSession(session.id)
                                }}
                            >
                                <MessageCircle className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                                <span className="text-xs text-muted-foreground/70 truncate flex-1 group-hover:text-foreground transition-colors">
                                    {session.title || t('sidebar.newConversationTitle')}
                                </span>
                                <span className="text-[10px] text-muted-foreground/30 flex-shrink-0">
                                    {getRelativeTime(session.updatedAt, t)}
                                </span>
                            </button>
                        ))}
                    </div>
                </motion.div>
            )}

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="mt-6 text-xs text-muted-foreground/50 z-10"
            >
                {t('welcome.basedOnRAG')}
            </motion.p>
        </motion.div>
    )
}