'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useChatStore, type UserInfo } from '@/stores/chat-store'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { Zap, Check, Sparkles } from 'lucide-react'

function getPlanLabel(plan: string, t: (key: string, params?: Record<string, string | number>) => string): string {
    switch (plan) {
        case 'agent': return t('settings.agentPlan')
        case 'pro': return t('settings.proPlan')
        default: return t('settings.freePlan')
    }
}

export function SubscriptionDialog() {
    const { t } = useTranslation()
    const isSubscriptionOpen = useChatStore((s) => s.isSubscriptionOpen)
    const setIsSubscriptionOpen = useChatStore((s) => s.setIsSubscriptionOpen)
    const user = useChatStore((s) => s.user)
    const setUser = useChatStore((s) => s.setUser)
    const [showPayment, setShowPayment] = useState(false)
    const [selectedPlan, setSelectedPlan] = useState<'pro' | 'agent'>('pro')

    const handleUpgrade = (plan: 'pro' | 'agent') => {
        setSelectedPlan(plan)
        setShowPayment(true)
    }

    const handleSwitch = (plan: string) => {
        if (!user) return
        const updated: UserInfo = { ...user, plan }
        setUser(updated)
        localStorage.setItem('lingxi_user', JSON.stringify(updated))
        toast.success(t('settings.planSwitched', { plan: getPlanLabel(plan, t) }))
    }

    if (!user) {
        return (
            <Dialog open={isSubscriptionOpen} onOpenChange={setIsSubscriptionOpen}>
                <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden">
                    <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4">
                        <DialogHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                                    <Sparkles className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <DialogTitle className="text-lg">订阅方案</DialogTitle>
                                    <DialogDescription className="text-sm text-muted-foreground">
                                        请先登录后查看订阅方案
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>
                    <div className="px-6 pb-6 pt-4 text-center">
                        <p className="text-sm text-muted-foreground">登录后可升级订阅方案</p>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <>
            <Dialog open={isSubscriptionOpen} onOpenChange={setIsSubscriptionOpen}>
                <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden">
                    <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4">
                        <DialogHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                                    <Sparkles className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <DialogTitle className="text-lg">订阅方案</DialogTitle>
                                    <DialogDescription className="text-sm text-muted-foreground">
                                        当前方案：{getPlanLabel(user.plan, t)}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <div className="px-6 pb-6 space-y-4">
                        <div
                            className={`rounded-lg border p-4 cursor-pointer transition-all ${
                                user.plan === 'free'
                                    ? 'border-primary/30 bg-primary/5'
                                    : 'border-border/50 hover:border-primary/20'
                            }`}
                            onClick={() => handleSwitch('free')}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold">{t('settings.freePlan')}</p>
                                    <p className="text-lg font-bold text-primary mt-0.5">{t('settings.planFreePrice')}</p>
                                </div>
                                {user.plan === 'free' && (
                                    <Badge variant="secondary" className="text-[10px]">
                                        <Check className="h-3 w-3 mr-0.5" />
                                        当前
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">{t('settings.planFreeDesc')}</p>
                        </div>

                        <div
                            className={`rounded-lg border p-4 cursor-pointer transition-all ${
                                user.plan === 'pro'
                                    ? 'border-primary/30 bg-primary/5'
                                    : 'border-border/50 hover:border-primary/20'
                            }`}
                            onClick={() => user.plan !== 'pro' && handleUpgrade('pro')}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold">{t('settings.proPlan')}</p>
                                    <p className="text-lg font-bold text-primary mt-0.5">{t('settings.planProPrice')}</p>
                                </div>
                                {user.plan === 'pro' ? (
                                    <Badge variant="secondary" className="text-[10px]">
                                        <Check className="h-3 w-3 mr-0.5" />
                                        当前
                                    </Badge>
                                ) : (
                                    <Badge className="text-[10px] bg-gradient-to-r from-primary to-primary/80">
                                        <Zap className="h-3 w-3 mr-0.5" />
                                        升级
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">{t('settings.planProDesc')}</p>
                        </div>

                        <div
                            className={`rounded-lg border p-4 cursor-pointer transition-all ${
                                user.plan === 'agent'
                                    ? 'border-primary/30 bg-primary/5'
                                    : 'border-border/50 hover:border-primary/20'
                            }`}
                            onClick={() => user.plan !== 'agent' && handleUpgrade('agent')}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold">{t('settings.agentPlan')}</p>
                                    <p className="text-lg font-bold text-primary mt-0.5">{t('settings.planAgentPrice')}</p>
                                </div>
                                {user.plan === 'agent' ? (
                                    <Badge variant="secondary" className="text-[10px]">
                                        <Check className="h-3 w-3 mr-0.5" />
                                        当前
                                    </Badge>
                                ) : (
                                    <Badge className="text-[10px] bg-gradient-to-r from-primary to-primary/80">
                                        <Zap className="h-3 w-3 mr-0.5" />
                                        升级
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">{t('settings.planAgentDesc')}</p>
                        </div>

                        <Separator />

                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                            <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                                ⚠️ 方案切换即刻生效。升级需完成支付后联系客服开通。
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showPayment} onOpenChange={setShowPayment}>
                <DialogContent className="sm:max-w-[360px] p-0 gap-0 overflow-hidden">
                    <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4 text-center">
                        <DialogHeader>
                            <DialogTitle className="text-lg">
                                {selectedPlan === 'pro' ? t('settings.upgradeToPro') : t('settings.upgradeToAgent')}
                            </DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">
                                {t('settings.paymentQRCode')}
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="px-6 pb-6 text-center space-y-4">
                        <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-lg border border-border/50 bg-muted/30">
                            <span className="text-xs text-muted-foreground">QR Code</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                            {t('settings.paymentNotice')}
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setShowPayment(false)}
                        >
                            {t('settings.cancel')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}