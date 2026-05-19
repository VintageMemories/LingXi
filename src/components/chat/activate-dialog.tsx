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
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useChatStore, type UserInfo } from '@/stores/chat-store'
import { useTranslation } from '@/lib/i18n'
import { toast } from 'sonner'
import { Sparkles, Loader2, Check, Key, X } from 'lucide-react'

interface ActivateDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ActivateDialog({ open, onOpenChange }: ActivateDialogProps) {
    const { t } = useTranslation()
    const user = useChatStore((s) => s.user)
    const setUser = useChatStore((s) => s.setUser)
    const [code, setCode] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<'idle' | 'success' | 'failed'>('idle')
    const [resultMessage, setResultMessage] = useState('')

    const handleActivate = async () => {
        if (!code.trim() || !user) return

        setIsLoading(true)
        setResult('idle')
        setResultMessage('')

        try {
            const res = await fetch('/api/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code.trim(), userId: user.id }),
            })

            const data = await res.json()

            if (!res.ok) {
                setResult('failed')
                setResultMessage(data.error || '激活失败')
                return
            }

            setResult('success')
            setResultMessage(data.message)

            const updated: UserInfo = { ...user, plan: data.plan }
            setUser(updated)
            localStorage.setItem('lingxi_user', JSON.stringify(updated))
            toast.success(data.message)

            setTimeout(() => {
                onOpenChange(false)
                setCode('')
                setResult('idle')
                setResultMessage('')
            }, 1500)
        } catch {
            setResult('failed')
            setResultMessage('网络错误，请稍后重试')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden">
                <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                                <Key className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg">激活码</DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground">
                                    输入激活码解锁高级功能
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="px-6 pb-6 space-y-4">
                    {!user ? (
                        <p className="text-sm text-muted-foreground text-center py-4">请先登录后使用激活码</p>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">激活码</label>
                                <div className="flex gap-2">
                                    <Input
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        placeholder="请输入激活码"
                                        className="flex-1"
                                        onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                                        disabled={isLoading}
                                    />
                                    <Button
                                        onClick={handleActivate}
                                        disabled={!code.trim() || isLoading}
                                        className="shrink-0"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            '激活'
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {result === 'success' && (
                                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 flex items-center gap-2">
                                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400">{resultMessage}</p>
                                </div>
                            )}

                            {result === 'failed' && (
                                <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 flex items-center gap-2">
                                    <X className="h-4 w-4 text-red-500 shrink-0" />
                                    <p className="text-xs text-red-600 dark:text-red-400">{resultMessage}</p>
                                </div>
                            )}

                            <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    激活码可解锁 Pro 或 Agent 方案，激活后永久有效。
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}