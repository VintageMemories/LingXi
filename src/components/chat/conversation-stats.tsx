'use client'

import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatStore } from '@/stores/chat-store'
import { useTranslation } from '@/lib/i18n'
import {
  MessageSquare,
  Bot,
  User,
  Clock,
  Type,
  Bookmark,
  Pin,
  BarChart3,
  TrendingUp,
} from 'lucide-react'

function formatDuration(ms: number, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (ms < 60000) return `${Math.floor(ms / 1000)}${t('stats.secondsUnit')}`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}${t('stats.minutesUnit')}`
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  return minutes > 0 ? `${hours}${t('stats.hoursUnit')}${minutes}${t('stats.minutesUnit')}` : `${hours}${t('stats.hoursUnit')}`
}

export function ConversationStats() {
  const { t } = useTranslation()
  const isStatsOpen = useChatStore((s) => s.isStatsOpen)
  const setIsStatsOpen = useChatStore((s) => s.setIsStatsOpen)
  const messages = useChatStore((s) => s.messages)
  const currentDomain = useChatStore((s) => s.currentDomain)

  const stats = useMemo(() => {
    const totalMessages = messages.length
    const userMessages = messages.filter((m) => m.role === 'user')
    const aiMessages = messages.filter((m) => m.role === 'assistant')

    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
    const userChars = userMessages.reduce((sum, m) => sum + m.content.length, 0)
    const aiChars = aiMessages.reduce((sum, m) => sum + m.content.length, 0)

    const avgResponseLength = aiMessages.length > 0
        ? Math.round(aiChars / aiMessages.length)
        : 0

    const duration = totalMessages >= 2
        ? messages[messages.length - 1].timestamp - messages[0].timestamp
        : 0

    const intentCounts = new Map<string, number>()
    for (const m of aiMessages) {
      if (m.intent) {
        intentCounts.set(m.intent, (intentCounts.get(m.intent) || 0) + 1)
      }
    }
    const intentDistribution = Array.from(intentCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
    const maxIntentCount = intentDistribution.length > 0 ? intentDistribution[0][1] : 1

    const bookmarkedCount = messages.filter((m) => m.bookmarked).length
    const pinnedCount = messages.filter((m) => m.pinned).length

    return {
      totalMessages,
      userCount: userMessages.length,
      aiCount: aiMessages.length,
      totalChars,
      userChars,
      aiChars,
      avgResponseLength,
      duration,
      intentDistribution,
      maxIntentCount,
      bookmarkedCount,
      pinnedCount,
    }
  }, [messages])

  if (stats.totalMessages === 0) return null

  return (
      <Dialog open={isStatsOpen} onOpenChange={setIsStatsOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden max-h-[85vh]">
          <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg">{t('stats.title')}</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    {t('stats.statsFor', { name: currentDomain?.name || t('stats.currentChat') })}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <ScrollArea className="max-h-[60vh]">
            <div className="px-6 pb-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  {t('stats.messageOverview')}
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-transparent p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{stats.totalMessages}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{t('stats.totalMessages')}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <User className="h-3.5 w-3.5 text-primary" />
                      <span className="text-2xl font-bold">{stats.userCount}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{t('stats.userMessages')}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                      <span className="text-2xl font-bold">{stats.aiCount}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{t('stats.aiMessages')}</div>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{t('stats.userVsAIRatio')}</span>
                    <span>{stats.userCount} : {stats.aiCount}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                    <div
                        className="bg-primary/70 transition-all duration-500"
                        style={{
                          width: stats.totalMessages > 0
                              ? `${(stats.userCount / stats.totalMessages) * 100}%`
                              : '50%',
                        }}
                    />
                    <div
                        className="bg-primary/30 transition-all duration-500"
                        style={{
                          width: stats.totalMessages > 0
                              ? `${(stats.aiCount / stats.totalMessages) * 100}%`
                              : '50%',
                        }}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Type className="h-4 w-4 text-primary" />
                  {t('stats.textStats')}
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                    <span className="text-sm text-muted-foreground">{t('stats.totalChars')}</span>
                    <span className="text-sm font-semibold">{stats.totalChars.toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border bg-card p-3">
                      <div className="text-[11px] text-muted-foreground mb-0.5">{t('stats.userChars')}</div>
                      <div className="text-lg font-semibold">{stats.userChars.toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <div className="text-[11px] text-muted-foreground mb-0.5">{t('stats.aiChars')}</div>
                      <div className="text-lg font-semibold">{stats.aiChars.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                    <span className="text-sm text-muted-foreground">{t('stats.avgAILength')}</span>
                    <span className="text-sm font-semibold">{stats.avgResponseLength.toLocaleString()} {t('stats.charsUnit')}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  {t('stats.duration')}
                </h3>
                <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-transparent p-4 text-center">
                  <div className="text-3xl font-bold text-primary animate-gradient-text bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
                    {stats.duration > 0 ? formatDuration(stats.duration, t) : '—'}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {stats.duration > 0
                        ? t('stats.fromTo', {
                          from: new Date(messages[0]?.timestamp || 0).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                          to: new Date(messages[messages.length - 1]?.timestamp || 0).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                        })
                        : t('stats.singleMessage')
                    }
                  </div>
                </div>
              </div>

              {stats.intentDistribution.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        {t('stats.intentDistribution')}
                      </h3>
                      <div className="space-y-2">
                        {stats.intentDistribution.map(([intent, count]) => (
                            <div key={intent} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Badge
                                    variant="outline"
                                    className="text-[10px] font-normal border-0 bg-primary/10 text-primary/80 px-1.5 py-0 h-5 rounded-full"
                                >
                                  {t(`intents.${intent}`) || intent}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground">{count} {t('stats.timesUnit')}</span>
                              </div>
                              <Progress
                                  value={(count / stats.maxIntentCount) * 100}
                                  className="h-1.5 animate-progress-fill [&>div]:bg-primary/60"
                              />
                            </div>
                        ))}
                      </div>
                    </div>
                  </>
              )}

              <Separator />

              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-primary" />
                  {t('stats.markStats')}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-card p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Bookmark className="h-4 w-4 text-primary" />
                      <span className="text-2xl font-bold">{stats.bookmarkedCount}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{t('stats.bookmarkedCount')}</div>
                  </div>
                  <div className="rounded-lg border bg-card p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Pin className="h-4 w-4 text-amber-500" />
                      <span className="text-2xl font-bold">{stats.pinnedCount}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{t('stats.pinnedCount')}</div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
  )
}