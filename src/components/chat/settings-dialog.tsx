'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useChatStore, type UserInfo, type TokenUsage } from '@/stores/chat-store'
import { useTranslation, type Locale } from '@/lib/i18n'
import { KnowledgeManager } from '@/components/chat/knowledge-manager'
import {
  Settings,
  Sparkles,
  Download,
  Trash2,
  Keyboard,
  Info,
  Shield,
  BarChart3,
  User,
  MessageSquare,
  Copy,
  FileText,
  FileJson,
  FileDown,
  Check,
  Pencil,
  RotateCcw,
  ChevronDown,
  LogIn,
  Share2,
  Camera,
  X,
  Loader2,
  Printer,
  BookOpen,
  Eye,
  EyeOff,
  ExternalLink,
  Zap,
  Bot,
  RefreshCw,
  Search,
  Coins,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'

// ============ Language Selector Component ============
function LanguageSelector() {
  const { locale, setLocale } = useTranslation()

  return (
    <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
      <SelectTrigger className="w-[120px]" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="zh">中文</SelectItem>
        <SelectItem value="en">English</SelectItem>
      </SelectContent>
    </Select>
  )
}

function getPlanLabel(plan: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  switch (plan) {
    case 'agent': return t('settings.agentPlan')
    case 'rag': return t('settings.agentPlan')
    case 'pro': return t('settings.proPlan')
    default: return t('settings.freePlan')
  }
}

function getUsageColor(percentage: number): string {
  if (percentage > 80) return 'text-red-500'
  if (percentage > 60) return 'text-yellow-500'
  return 'text-emerald-500'
}

function getProgressColor(percentage: number): string {
  if (percentage > 80) return '[&>div]:bg-red-500'
  if (percentage > 60) return '[&>div]:bg-yellow-500'
  return '[&>div]:bg-emerald-500'
}

function getInitials(name: string): string {
  return name.slice(0, 1).toUpperCase()
}

// ============ Profile Section ============
function ProfileSection() {
  const { t } = useTranslation()
  const user = useChatStore((s) => s.user)
  const setUser = useChatStore((s) => s.setUser)
  const setIsAuthDialogOpen = useChatStore((s) => s.setIsAuthDialogOpen)

  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const startEditName = useCallback(() => {
    if (user) {
      setEditName(user.name)
      setIsEditingName(true)
    }
  }, [user])

  const saveName = useCallback(() => {
    if (!user || !editName.trim()) return
    const updated: UserInfo = { ...user, name: editName.trim() }
    setUser(updated)
    localStorage.setItem('lingxi_user', JSON.stringify(updated))
    setIsEditingName(false)
    toast.success(t('settings.nicknameUpdated'))
  }, [user, editName, setUser])

  const cancelEditName = useCallback(() => {
    setIsEditingName(false)
    setEditName('')
  }, [])

  const handlePlanChange = useCallback((plan: string) => {
    if (!user) return
    const updated: UserInfo = { ...user, plan }
    setUser(updated)
    localStorage.setItem('lingxi_user', JSON.stringify(updated))
    toast.success(t('settings.planSwitched', { plan: getPlanLabel(plan, t) }))
  }, [user, setUser])

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate type
    if (!file.type.startsWith('image/')) {
      toast.error(t('settings.imageFilesOnly'))
      return
    }

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('settings.imageSizeLimit2MB'))
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onload = (event) => {
      setAvatarPreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload
    setIsUploadingAvatar(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader2 = new FileReader()
        reader2.onload = () => resolve(reader2.result as string)
        reader2.onerror = reject
        reader2.readAsDataURL(file)
      })

      const res = await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || t('settings.avatarUploadFailed'))
        setAvatarPreview(null)
        return
      }

      const data = await res.json()
      if (user) {
        const updated: UserInfo = { ...user, avatar: data.avatarUrl }
        setUser(updated)
        localStorage.setItem('lingxi_user', JSON.stringify(updated))
        toast.success(t('settings.avatarUpdated'))
      }
    } catch {
      toast.error(t('settings.avatarUploadNetworkError'))
      setAvatarPreview(null)
    } finally {
      setIsUploadingAvatar(false)
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [user, setUser])

  const handleRemoveAvatar = useCallback(async () => {
    if (!user?.avatar) return

    try {
      await fetch('/api/avatar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: user.avatar }),
      })
    } catch {
      // Ignore delete errors
    }

    const updated: UserInfo = { ...user, avatar: undefined }
    setUser(updated)
    localStorage.setItem('lingxi_user', JSON.stringify(updated))
    setAvatarPreview(null)
    toast.success(t('settings.avatarRemoved'))
  }, [user, setUser])

  if (!user) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <LogIn className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{t('settings.notLoggedInShort')}</p>
        <p className="text-xs text-muted-foreground/60 mt-1 mb-3">{t('settings.loginPrompt')}</p>
        <Button
          size="sm"
          variant="outline"
          className="border-primary/30 text-primary hover:bg-primary/10"
          onClick={() => setIsAuthDialogOpen(true)}
        >
          <LogIn className="h-3.5 w-3.5 mr-1.5" />
          {t('settings.goLogin')}
        </Button>
      </div>
    )
  }

  const avatarSrc = avatarPreview || user.avatar

  return (
    <div className="space-y-4">
      {/* Avatar + Name */}
      <div className="flex items-center gap-4">
        <div className="relative group">
          <Avatar
            className="h-14 w-14 ring-2 ring-primary/20 cursor-pointer"
            onClick={handleFileSelect}
          >
            {avatarSrc && <AvatarImage src={avatarSrc} alt={user.name} />}
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-lg font-semibold">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          {/* Overlay on hover */}
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            onClick={handleFileSelect}
          >
            {isUploadingAvatar ? (
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            ) : (
              <Camera className="h-5 w-5 text-white" />
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName()
                  if (e.key === 'Escape') cancelEditName()
                }}
                className="h-8 text-sm"
                autoFocus
              />
              <Button size="sm" className="h-8 px-3" onClick={saveName}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-3" onClick={cancelEditName}>
                {t('settings.cancel')}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold truncate">{user.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={startEditName}
                aria-label={t('settings.editNickname')}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
        </div>
      </div>

      {/* Avatar actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={handleFileSelect}
          disabled={isUploadingAvatar}
        >
          {isUploadingAvatar ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5 mr-1.5" />
          )}
          {isUploadingAvatar ? t('settings.uploading') : t('settings.uploadAvatar')}
        </Button>
        {user.avatar && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
            onClick={handleRemoveAvatar}
            disabled={isUploadingAvatar}
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            {t('settings.removeAvatar')}
          </Button>
        )}
      </div>

      <Separator />

      {/* Plan selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">{t('settings.subscriptionPlan')}</label>
        <Select value={user.plan} onValueChange={handlePlanChange}>
          <SelectTrigger className="w-full" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{t('settings.freePlan')}</Badge>
                <span className="text-xs text-muted-foreground">20{t('settings.times')}{t('settings.perDay')}</span>
              </div>
            </SelectItem>
            <SelectItem value="pro">
              <div className="flex items-center gap-2">
                <Badge className="text-[10px]">{t('settings.proPlan')}</Badge>
                <span className="text-xs text-muted-foreground">100{t('settings.times')}{t('settings.perDay')}</span>
              </div>
            </SelectItem>
            <SelectItem value="agent">
              <div className="flex items-center gap-2">
                <Badge className="text-[10px] bg-gradient-to-r from-primary to-primary/80">{t('settings.agentPlan')}</Badge>
                <span className="text-xs text-muted-foreground">{t('settings.unlimited')}</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-primary/70">
          {t('settings.ownApiKeyNoLimit')}
        </p>
      </div>
    </div>
  )
}

// ============ Usage Section ============
function UsageSection() {
  const { t } = useTranslation()
  const user = useChatStore((s) => s.user)
  const settings = useChatStore((s) => s.settings)
  const dailyUsage = useChatStore((s) => s.dailyUsage)
  const getDailyLimit = useChatStore((s) => s.getDailyLimit)

  const dailyLimit = getDailyLimit()
  const isUnlimited = dailyLimit === Infinity
  const usagePercentage = isUnlimited ? 0 : Math.min((dailyUsage.count / dailyLimit) * 100, 100)
  const usageColorClass = isUnlimited ? 'text-emerald-500' : getUsageColor(usagePercentage)
  const progressColorClass = isUnlimited ? '[&>div]:bg-emerald-500' : getProgressColor(usagePercentage)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('settings.currentPlan')}</span>
        <Badge
          variant="outline"
          className="border-primary/30 text-primary text-[10px] font-semibold"
        >
          {user ? getPlanLabel(user.plan, t) : t('settings.freePlan')}
        </Badge>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('settings.dailyConversations')}</span>
          <span className={`text-xs font-medium ${usageColorClass}`}>
            {isUnlimited
              ? `${dailyUsage.count} ${t('settings.times')} · ${t('settings.unlimited')}`
              : `${dailyUsage.count}/${dailyLimit} ${t('settings.times')}`
            }
          </span>
        </div>
        <Progress
          value={isUnlimited ? Math.min(dailyUsage.count, 100) : usagePercentage}
          className={`h-2 animate-progress-fill ${progressColorClass}`}
        />
        {!isUnlimited && usagePercentage > 80 && (
          <p className="text-[10px] text-red-500/80">
            {t('settings.usageOver80')}
          </p>
        )}
        {!isUnlimited && usagePercentage <= 80 && usagePercentage > 60 && (
          <p className="text-[10px] text-yellow-500/80">
            {t('settings.usageOver60')}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-muted-foreground/60">
          {t('settings.dailyReset')}
        </span>
        {settings.apiKey ? (
          <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">
            {t('settings.ownApiKeyNoLimit')}
          </span>
        ) : !user ? (
          <span className="text-[10px] text-primary/70">
            {t('settings.loginForHigherLimit')}
          </span>
        ) : null}
      </div>
    </div>
  )
}

// ============ Token Usage Section ============
const MODEL_COSTS_DISPLAY: Record<string, { prompt: number; completion: number }> = {
  'gpt-4o': { prompt: 250, completion: 1000 },
  'gpt-4o-mini': { prompt: 15, completion: 60 },
  'deepseek-chat': { prompt: 14, completion: 28 },
  'deepseek-reasoner': { prompt: 55, completion: 219 },
  'qwen-max': { prompt: 20, completion: 60 },
  'qwen-plus': { prompt: 4, completion: 12 },
  'qwen-turbo': { prompt: 1, completion: 2 },
  'ernie-4.0': { prompt: 12, completion: 12 },
  'ernie-3.5-turbo': { prompt: 1.2, completion: 1.2 },
}

function TokenUsageSection() {
  const { t } = useTranslation()
  const totalTokenUsage = useChatStore((s) => s.totalTokenUsage)
  const resetTokenUsage = useChatStore((s) => s.resetTokenUsage)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const costInDollars = (totalTokenUsage.estimatedCost / 100).toFixed(4)

  const handleReset = useCallback(() => {
    resetTokenUsage()
    setShowResetConfirm(false)
    toast.success(t('settings.usageResetSuccess'))
  }, [resetTokenUsage, t])

  return (
    <div className="space-y-4">
      {/* Token usage summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{t('settings.totalTokens')}</p>
          <p className="text-lg font-bold text-foreground mt-0.5">{totalTokenUsage.totalTokens.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{t('settings.estimatedCost')}</p>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">${costInDollars}</p>
          <p className="text-[9px] text-muted-foreground/50">{t('settings.costUnit')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-muted/20 p-2.5">
          <p className="text-[10px] text-muted-foreground/60">{t('settings.promptTokens')}</p>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{totalTokenUsage.promptTokens.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-muted/20 p-2.5">
          <p className="text-[10px] text-muted-foreground/60">{t('settings.completionTokens')}</p>
          <p className="text-sm font-semibold text-sky-600 dark:text-sky-400">{totalTokenUsage.completionTokens.toLocaleString()}</p>
        </div>
      </div>

      <Separator />

      {/* Model pricing reference */}
      <div>
        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5 text-amber-500" />
          {t('settings.modelCosts')}
        </h4>
        <p className="text-[10px] text-muted-foreground/50 mb-2">{t('settings.perMillionTokens')} (USD)</p>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground">Model</th>
                <th className="text-right px-2.5 py-1.5 font-medium text-muted-foreground">Input</th>
                <th className="text-right px-2.5 py-1.5 font-medium text-muted-foreground">Output</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(MODEL_COSTS_DISPLAY).map(([model, costs]) => (
                <tr key={model} className="border-t border-muted/50">
                  <td className="px-2.5 py-1.5 font-mono text-foreground">{model}</td>
                  <td className="text-right px-2.5 py-1.5 text-emerald-600/70 dark:text-emerald-400/70">${(costs.prompt / 100).toFixed(2)}</td>
                  <td className="text-right px-2.5 py-1.5 text-amber-600/70 dark:text-amber-400/70">${(costs.completion / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Separator />

      {/* Reset usage stats */}
      <div>
        {showResetConfirm ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-600 dark:text-amber-400">{t('settings.usageResetConfirm')}</p>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setShowResetConfirm(false)}
              >
                {t('settings.cancel')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={handleReset}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                {t('settings.resetUsage')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => setShowResetConfirm(true)}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            {t('settings.resetUsage')}
          </Button>
        )}
      </div>
    </div>
  )
}

// ============ Chat Settings Section ============
function ChatSettingsSection() {
  const { t } = useTranslation()
  const settings = useChatStore((s) => s.settings)
  const updateSettings = useChatStore((s) => s.updateSettings)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm">{t('settings.autoScroll')}</p>
          <p className="text-xs text-muted-foreground">{t('settings.autoScrollDesc')}</p>
        </div>
        <Switch
          checked={settings.autoScroll}
          onCheckedChange={(checked) => updateSettings({ autoScroll: checked })}
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm">{t('settings.streamOutput')}</p>
          <p className="text-xs text-muted-foreground">{t('settings.streamOutputDesc')}</p>
        </div>
        <Switch
          checked={settings.streamMode}
          onCheckedChange={(checked) => updateSettings({ streamMode: checked })}
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm">{t('settings.showSources')}</p>
          <p className="text-xs text-muted-foreground">{t('settings.showSourcesDesc')}</p>
        </div>
        <Switch
          checked={settings.showSources}
          onCheckedChange={(checked) => updateSettings({ showSources: checked })}
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm">{t('settings.showIntent')}</p>
          <p className="text-xs text-muted-foreground">{t('settings.showIntentDesc')}</p>
        </div>
        <Switch
          checked={settings.showIntent}
          onCheckedChange={(checked) => updateSettings({ showIntent: checked })}
        />
      </div>

      {/* Language Selector */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm">{t('settings.language')}</p>
          <p className="text-xs text-muted-foreground">{t('settings.languageDesc')}</p>
        </div>
        <LanguageSelector />
      </div>
    </div>
  )
}

// ============ API Config Section ============
const PROVIDER_MODELS: Record<string, { id: string; name: string }[]> = {
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat' },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'o1-mini', name: 'O1 Mini' },
  ],
  qwen: [
    { id: 'qwen-max', name: 'Qwen Max' },
    { id: 'qwen-plus', name: 'Qwen Plus' },
    { id: 'qwen-turbo', name: 'Qwen Turbo' },
  ],
  wenxin: [
    { id: 'ernie-4.0', name: 'ERNIE 4.0' },
    { id: 'ernie-3.5-turbo', name: 'ERNIE 3.5 Turbo' },
  ],
  copilot: [
    { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus' },
    { id: 'gpt-4o', name: 'GPT-4o' },
  ],
  zhipu: [
    { id: 'glm-4-plus', name: 'GLM-4 Plus' },
    { id: 'glm-4-flash', name: 'GLM-4 Flash' },
    { id: 'glm-4-air', name: 'GLM-4 Air' },
  ],
  custom: [],
}

const PROVIDER_LINKS: Record<string, string> = {
  deepseek: 'https://platform.deepseek.com/api_keys',
  openai: 'https://platform.openai.com/api-keys',
  qwen: 'https://dashscope.console.aliyun.com/apiKey',
  wenxin: 'https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application',
  copilot: 'https://github.com/settings/tokens',
  zhipu: 'https://open.bigmodel.cn/usercenter/apikeys',
  custom: 'https://openrouter.ai/keys',
}

function ApiConfigSection() {
  const { t } = useTranslation()
  const settings = useChatStore((s) => s.settings)
  const updateSettings = useChatStore((s) => s.updateSettings)
  const [showApiKey, setShowApiKey] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle')
  const [saveKeyStatus, setSaveKeyStatus] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<{ id: string; name: string }[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [fetchedModelsSource, setFetchedModelsSource] = useState<'builtin' | 'custom' | null>(null)
  const [fetchedTotal, setFetchedTotal] = useState<number | null>(null)
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'noKey' | 'loading' | 'success' | 'failed'>('idle')
  const [fetchStatusCount, setFetchStatusCount] = useState(0)

  const currentProvider = settings.apiProvider || 'deepseek'
  const builtinModels = PROVIDER_MODELS[currentProvider] || []
  const isCustom = currentProvider === 'custom'

  // Use fetched models if available, otherwise fall back to builtin models
  const models = fetchedModels.length > 0 ? fetchedModels : builtinModels
  const isFetched = fetchedModels.length > 0

  const handleProviderChange = useCallback((provider: string) => {
    const defaultModels = PROVIDER_MODELS[provider]
    const savedModel = settings.selectedModels?.[provider] || (defaultModels.length > 0 ? defaultModels[0].id : '')
    const savedKey = settings.apiKeys?.[provider] || ''
    setFetchedModels([])
    setFetchedModelsSource(null)
    setFetchedTotal(null)
    setFetchStatus('idle')
    updateSettings({
      apiProvider: provider,
      apiKey: savedKey,
      selectedModel: savedModel,
      apiBaseUrl: provider === 'custom' ? settings.apiBaseUrl : '',
    })
  }, [updateSettings, settings.apiBaseUrl, settings.selectedModels, settings.apiKeys])

  const handleFetchModels = useCallback(async () => {
    setIsLoadingModels(true)
    setFetchStatus('loading')
    try {
      const params = new URLSearchParams({
        provider: currentProvider,
        api_key: settings.apiKey || '',
        base_url: settings.apiBaseUrl || '',
      })

      const res = await fetch(`/api/models?${params.toString()}`)
      const data = await res.json()

      if (!res.ok || data.error) {
        setFetchStatus('failed')
        setTimeout(() => setFetchStatus('idle'), 4000)
        return
      }

      const modelList = data.models || []
      if (modelList.length > 0) {
        setFetchedModels(modelList)
        setFetchedModelsSource(currentProvider)
        setFetchedTotal(modelList.length)
        setFetchStatusCount(modelList.length)
        if (modelList.length > 0) {
          updateSettings({ selectedModel: modelList[0].id })
        }
        setFetchStatus('success')
        setTimeout(() => setFetchStatus('idle'), 4000)
      } else {
        setFetchStatus('failed')
        setTimeout(() => setFetchStatus('idle'), 4000)
      }
    } catch {
      setFetchStatus('failed')
      setTimeout(() => setFetchStatus('idle'), 4000)
    } finally {
      setIsLoadingModels(false)
    }
  }, [currentProvider, settings.apiKey, settings.apiBaseUrl, t, updateSettings])

  const handleTestConnection = useCallback(async () => {
    if (!settings.apiKey) {
      toast.error(t('settings.testConnectionFailed'))
      return
    }
    setTestStatus('testing')
    try {
      const baseUrl = settings.apiBaseUrl || (
          settings.apiProvider === 'deepseek' ? 'https://api.deepseek.com' :
              settings.apiProvider === 'openai' ? 'https://api.openai.com' :
                  settings.apiProvider === 'qwen' ? 'https://dashscope.aliyuncs.com/compatible-mode' :
                      settings.apiProvider === 'wenxin' ? 'https://aip.baidubce.com' :
                          settings.apiProvider === 'copilot' ? 'https://api.githubcopilot.com' :
                              settings.apiProvider === 'zhipu' ? 'https://open.bigmodel.cn/api/paas/v4' :
                                  ''
      )

      if (!baseUrl) {
        toast.error('请先设置 API Base URL')
        setTestStatus('failed')
        return
      }

      const res = await fetch(`${baseUrl}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
        },
      })

      if (res.ok) {
        setTestStatus('success')
        toast.success(t('settings.testConnectionSuccess'))
      } else {
        setTestStatus('failed')
        toast.error(t('settings.testConnectionFailed'))
      }
    } catch {
      setTestStatus('failed')
      toast.error(t('settings.testConnectionFailed'))
    }
    setTimeout(() => setTestStatus('idle'), 3000)
  }, [settings.apiKey, settings.apiProvider, settings.apiBaseUrl, t])

  return (
    <div className="space-y-4">
      {/* Provider selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">{t('settings.apiProvider')}</label>
        <Select value={currentProvider} onValueChange={handleProviderChange}>
          <SelectTrigger className="w-full" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="deepseek">{t('settings.providerDeepseek')}</SelectItem>
            <SelectItem value="openai">{t('settings.providerOpenai')}</SelectItem>
            <SelectItem value="qwen">{t('settings.providerQwen')}</SelectItem>
            <SelectItem value="wenxin">{t('settings.providerWenxin')}</SelectItem>
            <SelectItem value="copilot">GitHub Copilot</SelectItem>
            <SelectItem value="zhipu">智谱AI (ChatGLM)</SelectItem>
            <SelectItem value="custom">{t('settings.providerCustom')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* API Key input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">{t('settings.apiKey')}</label>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/20 text-primary/60">
              <Shield className="h-2.5 w-2.5 mr-0.5" />
              {t('settings.apiKeyLocalOnly')}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={settings.apiKey}
              onChange={(e) => updateSettings({ apiKey: e.target.value })}
              placeholder={t('settings.apiKeyPlaceholder')}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setShowApiKey(!showApiKey)}
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <Button
            size="sm"
            className={`h-9 px-3 text-xs flex-shrink-0 transition-colors ${saveKeyStatus ? 'bg-emerald-500 text-white hover:bg-emerald-600' : ''}`}
            onClick={() => {
              const newKeys = { ...settings.apiKeys, [currentProvider]: settings.apiKey }
              const newModels = { ...settings.selectedModels, [currentProvider]: settings.selectedModel }
              updateSettings({ apiKey: settings.apiKey, apiKeys: newKeys, selectedModels: newModels })
              setSaveKeyStatus(true)
              toast.success(t('settings.apiKeySaved'))
              setTimeout(() => setSaveKeyStatus(false), 1500)
            }}
          >
            {saveKeyStatus ? <Check className="h-3.5 w-3.5 mr-1" /> : null}
            {saveKeyStatus ? t('settings.apiKeySaved') : t('settings.saveKey')}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/60">
          {t('settings.apiKeyHint')}
        </p>
      </div>

      {/* Base URL (shown for custom provider) */}
      {isCustom && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">{t('settings.apiBaseUrl')}</label>
          <Input
            value={settings.apiBaseUrl}
            onChange={(e) => updateSettings({ apiBaseUrl: e.target.value })}
            placeholder={t('settings.apiBaseUrlPlaceholder')}
          />
          <p className="text-[10px] text-muted-foreground/60">
            {t('settings.apiBaseUrlHint')}
          </p>
        </div>
      )}

      {/* Model selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">{t('settings.selectedModel')}</label>
          {/* Fetch/Refresh models button */}
          <div className="flex items-center gap-1.5">
            {fetchStatus !== 'idle' && (
              <span className="flex items-center gap-1 text-[10px] animate-fade-in">
                {fetchStatus === 'noKey' && (
                  <>
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-red-600 dark:text-red-400">{t('settings.fetchModelsNeedKey')}</span>
                  </>
                )}
                {fetchStatus === 'loading' && (
                  <>
                    <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                    <span className="text-yellow-600 dark:text-yellow-400">{t('settings.fetchModelsLoading')}</span>
                  </>
                )}
                {fetchStatus === 'success' && (
                  <>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">{t('settings.fetchModelsSuccess', { count: fetchStatusCount })}</span>
                  </>
                )}
                {fetchStatus === 'failed' && (
                  <>
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-red-600 dark:text-red-400">{t('settings.fetchModelsFailed')}</span>
                  </>
                )}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-primary hover:text-primary/80 disabled:text-muted-foreground/30"
              disabled={isLoadingModels}
              onClick={() => {
                if (!settings.apiKey) {
                  setFetchStatus('noKey')
                  setTimeout(() => setFetchStatus('idle'), 4000)
                  return
                }
                handleFetchModels()
              }}
            >
              {isLoadingModels ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : isFetched ? (
                <RefreshCw className="h-3 w-3 mr-1" />
              ) : (
                <Search className="h-3 w-3 mr-1" />
              )}
              {isFetched ? t('settings.refreshModels') : t('settings.fetchModels')}
            </Button>
          </div>
        </div>
        {/* Show fetched models count for custom providers */}
        {isCustom && fetchedTotal !== null && fetchedModelsSource === 'custom' && (
          <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">
            {t('settings.modelsCount', { count: fetchedTotal })}
          </p>
        )}
        {/* Get API Key link */}
        {!isCustom && PROVIDER_LINKS[currentProvider] && (
          <a
            href={PROVIDER_LINKS[currentProvider]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            {t('settings.getApiKey')} →
          </a>
        )}
        {/* Model selector */}
        {isFetched ? (
          <Select
            value={settings.selectedModel}
            onValueChange={(model) => updateSettings({ selectedModel: model })}
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {fetchedModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <span className="font-mono text-xs">{model.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={settings.selectedModel}
            onValueChange={(model) => updateSettings({ selectedModel: model })}
          >
            <SelectTrigger className="w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <span className="font-mono text-xs">{model.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Test connection button */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={handleTestConnection}
          disabled={!settings.apiKey || testStatus === 'testing'}
        >
          {testStatus === 'testing' ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              {t('settings.testConnectionTesting')}
            </>
          ) : testStatus === 'success' ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
              {t('settings.testConnectionSuccess')}
            </>
          ) : testStatus === 'failed' ? (
            <>
              <X className="h-3.5 w-3.5 mr-1.5 text-red-500" />
              {t('settings.testConnectionFailed')}
            </>
          ) : (
            <>
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              {t('settings.testConnection')}
            </>
          )}
        </Button>

      </div>
    </div>
  )
}

// ============ Inline Shortcuts Section ============
function ShortcutsSection() {
  const { t } = useTranslation()
  const setIsShortcutsOpen = useChatStore((s) => s.setIsShortcutsOpen)

  const shortcuts = [
    { keys: 'Ctrl + B', desc: t('keyboard.toggleSidebar') },
    { keys: 'Ctrl + Shift + N', desc: t('keyboard.newChat') },
    { keys: 'Ctrl + F', desc: t('keyboard.searchMessages') },
    { keys: 'Ctrl + /', desc: t('keyboard.shortcutPanel') },
    { keys: 'Enter', desc: t('keyboard.sendMessage') },
    { keys: 'Shift + Enter', desc: t('keyboard.newLine') },
    { keys: 'Escape', desc: t('keyboard.closePopup') },
  ]

  return (
    <div className="space-y-2">
      <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
        {shortcuts.map((s) => (
          <div key={s.desc} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{s.desc}</span>
            <kbd className="rounded bg-background px-1.5 py-0.5 text-[10px] font-mono border shadow-sm">
              {s.keys}
            </kbd>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={() => setIsShortcutsOpen(true)}
      >
        <Keyboard className="h-3.5 w-3.5 mr-1.5" />
        {t('settings.viewFullShortcuts')}
      </Button>
    </div>
  )
}

// ============ Data Management Section ============
function DataManagementSection() {
  const { t } = useTranslation()
  const messages = useChatStore((s) => s.messages)
  const sessionId = useChatStore((s) => s.sessionId)
  const clearChat = useChatStore((s) => s.clearChat)
  const setIsSettingsOpen = useChatStore((s) => s.setIsSettingsOpen)
  const currentDomain = useChatStore((s) => s.currentDomain)
  const [copied, setCopied] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareCode, setShareCode] = useState<string | null>(null)

  const exportAsMarkdown = useCallback(() => {
    if (messages.length === 0) return

    const title = `${t('settings.exportTitle')} - ${new Date().toLocaleDateString()}`
    let md = `# ${title}\n\n`
    md += `> ${t('settings.exportTime')}: ${new Date().toLocaleString()}\n`
    if (currentDomain) md += `> ${t('settings.domainLabel')}: ${currentDomain.display_name}\n`
    md += `> ${t('settings.messageCountLabel')}: ${messages.length}\n\n---\n\n`

    messages.forEach((m) => {
      const role = m.role === 'user' ? `**👤 ${t('settings.userLabel')}**` : `**🤖 ${t('settings.aiAssistantLabel')}**`
      const time = new Date(m.timestamp).toLocaleString()
      md += `${role}\n\n${m.content}\n`
      if (m.intent) md += `\n*${t('settings.intentLabel')}: ${m.intent}*\n`
      if (m.sources?.length) {
        md += `\n**${t('settings.referenceSources')}:**\n`
        m.sources.forEach((s, i) => {
          md += `${i + 1}. [${s.title}](${s.source})\n`
        })
      }
      md += '\n---\n\n'
    })

    downloadFile(md, `${t('settings.exportTitle')}_${formatDate()}.md`, 'text/markdown;charset=utf-8')
    toast.success(t('settings.exportSuccess', { format: 'Markdown' }))
  }, [messages, currentDomain, t])

  const exportAsJSON = useCallback(() => {
    if (messages.length === 0) return

    const data = {
      metadata: {
        exportTime: new Date().toISOString(),
        sessionId: sessionId || 'unknown',
        domain: currentDomain?.id || 'unknown',
        domainName: currentDomain?.display_name || t('settings.unknownDomain'),
        messageCount: messages.length,
        version: '1.0.0',
      },
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp).toISOString(),
        ...(m.intent ? { intent: m.intent } : {}),
        ...(m.confidence ? { confidence: m.confidence } : {}),
        ...(m.sources?.length ? { sources: m.sources } : {}),
        ...(m.feedback ? { feedback: m.feedback } : {}),
        ...(m.bookmarked ? { bookmarked: m.bookmarked } : {}),
      })),
    }

    const json = JSON.stringify(data, null, 2)
    downloadFile(json, `${t('settings.exportTitle')}_${formatDate()}.json`, 'application/json;charset=utf-8')
    toast.success(t('settings.exportSuccess', { format: 'JSON' }))
  }, [messages, sessionId, currentDomain, t])

  const exportAsText = useCallback(() => {
    if (messages.length === 0) return

    const exportData = messages.map((m) => ({
      role: m.role === 'user' ? t('settings.userLabel') : t('settings.aiAssistantLabel'),
      content: m.content,
      time: new Date(m.timestamp).toLocaleString(),
      ...(m.intent ? { intent: m.intent } : {}),
      ...(m.sources?.length ? { sources: m.sources } : {}),
    }))

    const text = exportData
      .map((m) => `[${m.time}] ${m.role}:\n${m.content}${m.intent ? `\n${t('settings.intentLabel')}: ${m.intent}` : ''}`)
      .join('\n\n---\n\n')

    downloadFile(text, `${t('settings.exportTitle')}_${formatDate()}.txt`, 'text/plain;charset=utf-8')
    toast.success(t('settings.exportSuccess', { format: t('settings.exportPlainText') }))
  }, [messages, t])

  const exportAsPDF = useCallback(() => {
    if (messages.length === 0) return

    // Create printable container
    const container = document.createElement('div')
    container.className = 'print-container'

    // Header
    const title = t('settings.exportTitle')
    const domainName = currentDomain?.display_name || t('settings.unknownDomain')
    const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })

    container.innerHTML = `
      <div class="print-header">
        <h1>${title}</h1>
        <p class="print-meta">${t('settings.domainLabel')}: ${domainName} · ${t('settings.exportTime')}: ${dateStr} · ${t('settings.messageCountLabel')}: ${messages.length}</p>
      </div>
      ${messages.map((m) => {
        const role = m.role === 'user' ? t('settings.userLabel') : t('settings.aiAssistantLabel')
        const roleClass = m.role === 'user' ? 'user-role' : 'ai-role'
        const msgClass = m.role === 'user' ? 'user' : 'assistant'
        const time = new Date(m.timestamp).toLocaleString()
        const intentTag = m.intent ? `<span class="print-intent">${m.intent}</span>` : ''
        const sourcesHtml = m.sources?.length
          ? `<div class="print-sources">${t('settings.referenceSources')}: ${m.sources.map((s, i) => `${i + 1}. ${s.title}`).join(' · ')}</div>`
          : ''
        return `
          <div class="print-message ${msgClass}">
            <div class="print-role ${roleClass}">${role}</div>
            <div class="print-time">${time}</div>
            <div class="print-content">${m.content}</div>
            ${intentTag}
            ${sourcesHtml}
          </div>
          <hr class="print-divider" />
        `
      }).join('')}
      <div class="print-footer">Lingxi · ${domainName}</div>
    `

    // Append to body, print, then remove
    document.body.appendChild(container)

    // Use setTimeout to ensure the DOM is rendered before printing
    setTimeout(() => {
      window.print()
      // Remove after a short delay to allow print dialog to capture content
      setTimeout(() => {
        document.body.removeChild(container)
      }, 1000)
    }, 100)

    toast.success(t('settings.exportSuccess', { format: 'PDF' }))
  }, [messages, sessionId, currentDomain, t])

  const copyToClipboard = useCallback(async () => {
    if (messages.length === 0) return

    const text = messages
      .map((m) => {
        const role = m.role === 'user' ? t('settings.userLabel') : t('settings.aiAssistantLabel')
        return `${role}: ${m.content}`
      })
      .join('\n\n')

    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success(t('settings.copiedToClipboard'))
  }, [messages, t])

  const handleClear = useCallback(() => {
    clearChat()
    setIsSettingsOpen(false)
  }, [clearChat, setIsSettingsOpen])

  const handleShare = useCallback(async () => {
    if (!sessionId || messages.length === 0) return
    setIsSharing(true)
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (!res.ok) {
        toast.error(t('settings.shareFailed'))
        return
      }
      const data = await res.json()
      setShareCode(data.shareCode)
      toast.success(t('settings.shareCodeGenerated'))
    } catch {
      toast.error(t('settings.shareFailedNetwork'))
    } finally {
      setIsSharing(false)
    }
  }, [sessionId, messages])

  const copyShareCode = useCallback(async () => {
    if (!shareCode) return
    await navigator.clipboard.writeText(shareCode)
    toast.success(t('settings.shareCodeCopied'))
  }, [shareCode])

  return (
    <div className="space-y-3">
      {/* Export dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between gap-2"
            disabled={messages.length === 0}
          >
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              {t('settings.exportCurrentChat')}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={exportAsMarkdown} disabled={messages.length === 0}>
            <FileDown className="h-4 w-4 mr-2 text-primary/70" />
            <div>
              <p className="text-sm">{t('settings.exportMarkdown')}</p>
              <p className="text-[10px] text-muted-foreground">{t('settings.exportMarkdownDesc')}</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportAsJSON} disabled={messages.length === 0}>
            <FileJson className="h-4 w-4 mr-2 text-amber-600/70" />
            <div>
              <p className="text-sm">{t('settings.exportJSON')}</p>
              <p className="text-[10px] text-muted-foreground">{t('settings.exportJSONDesc')}</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportAsText} disabled={messages.length === 0}>
            <FileText className="h-4 w-4 mr-2 text-emerald-600/70" />
            <div>
              <p className="text-sm">{t('settings.exportPlainText')}</p>
              <p className="text-[10px] text-muted-foreground">{t('settings.exportPlainTextDesc')}</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportAsPDF} disabled={messages.length === 0}>
            <Printer className="h-4 w-4 mr-2 text-rose-600/70" />
            <div>
              <p className="text-sm">{t('settings.exportPDF')}</p>
              <p className="text-[10px] text-muted-foreground">{t('settings.exportPDFDesc')}</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={copyToClipboard} disabled={messages.length === 0}>
            {copied ? (
              <Check className="h-4 w-4 mr-2 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4 mr-2 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm">{copied ? t('settings.copied') : t('settings.copyToClipboard')}</p>
              <p className="text-[10px] text-muted-foreground">{t('settings.exportPlainTextDesc')}</p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Copy to clipboard */}
      <Button
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={copyToClipboard}
        disabled={messages.length === 0}
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        {copied ? t('settings.copiedToClipboard') : t('settings.copyConversation')}
      </Button>

      {/* Clear chat */}
      <Button
        variant="outline"
        className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
        onClick={handleClear}
        disabled={messages.length === 0}
      >
        <Trash2 className="h-4 w-4" />
        {t('settings.clearCurrentChat')}
      </Button>

      <Separator />

      {/* Share Conversation */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Share2 className="h-3.5 w-3.5" />
          {t('settings.shareChat')}
        </h4>
        {!shareCode ? (
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-primary/20 text-primary hover:bg-primary/5"
            onClick={handleShare}
            disabled={!sessionId || messages.length === 0 || isSharing}
          >
            {isSharing ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            {isSharing ? t('settings.generating') : t('settings.shareChat')}
          </Button>
        ) : (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-background px-3 py-1.5 text-sm font-mono tracking-wider text-primary border">
                {shareCode}
              </code>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-primary"
                onClick={copyShareCode}
                aria-label={t('settings.copyShareCode')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              {t('settings.shareCodeHint')}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => setShareCode(null)}
            >
              {t('settings.regenerate')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============ Knowledge Tab Content ============
function KnowledgeTabContent() {
  const { t } = useTranslation()
  const [isKnowledgeOpen, setIsKnowledgeOpen] = useState(false)
  const [stats, setStats] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [isLoadingStats, setIsLoadingStats] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/knowledge?limit=1')
        if (res.ok) {
          const data = await res.json()
          setStats(data.countsByDomain || {})
          setTotal(data.total || 0)
        }
      } catch {
        // ignore
      } finally {
        setIsLoadingStats(false)
      }
    }
    fetchStats()
  }, [])

  const domainStats = [
    { key: 'medical', labelKey: 'settings.medicalDomain', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    { key: 'legal', labelKey: 'settings.legalDomain', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
    { key: 'finance', labelKey: 'settings.financeDomain', color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          {t('settings.knowledgeManagement')}
        </h3>
      </div>

      {/* Stats cards */}
      {isLoadingStats ? (
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">{t('settings.totalEntries')}</p>
            <p className="text-2xl font-bold text-primary">{total}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">{t('settings.domainCount')}</p>
            <p className="text-2xl font-bold text-primary">{Object.keys(stats).length}</p>
          </div>
        </div>
      )}

      {/* Domain breakdown */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t('settings.domainBreakdown')}</p>
        <div className="space-y-1.5">
          {domainStats.map((d) => (
            <div key={d.key} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${d.color}`}>
                  {t(d.labelKey)}
                </Badge>
              </div>
              <span className="text-sm font-medium">{stats[d.key] || 0} {t('settings.entriesUnit')}</span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Open knowledge manager button */}
      <Button
        variant="outline"
        className="w-full justify-start gap-2 border-primary/20 text-primary hover:bg-primary/5"
        onClick={() => setIsKnowledgeOpen(true)}
      >
        <BookOpen className="h-4 w-4" />
        {t('settings.openKnowledgeManager')}
      </Button>

      <p className="text-[10px] text-muted-foreground/60 text-center">
        {t('settings.knowledgeHint')}
      </p>

      {/* Knowledge Manager Dialog */}
      <KnowledgeManager open={isKnowledgeOpen} onOpenChange={setIsKnowledgeOpen} />
    </div>
  )
}

// ============ About Section ============
function AboutSection() {
  const { t } = useTranslation()
  const setIsAboutOpen = useChatStore((s) => s.setIsAboutOpen)

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">{t('about.title')} Lingxi</p>
            <p className="text-[10px] text-muted-foreground">{t('about.subtitle')}</p>
          </div>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-muted-foreground">{t('settings.versionLabel')}</div>
          <div className="text-right">v1.0.0</div>
          <div className="text-muted-foreground">{t('settings.frameworkLabel')}</div>
          <div className="text-right">Next.js 16</div>
          <div className="text-muted-foreground">{t('settings.retrievalEngine')}</div>
          <div className="text-right">BM25 + Vector + RRF</div>
          <div className="text-muted-foreground">{t('settings.modelLabel')}</div>
          <div className="text-right">GPT-4o</div>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={() => setIsAboutOpen(true)}
      >
        <Info className="h-3.5 w-3.5 mr-1.5" />
        {t('settings.viewDetails')}
      </Button>
    </div>
  )
}

// ============ Helper functions ============
function formatDate(): string {
  return new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ============ Main Settings Dialog ============
export function SettingsDialog() {
  const { t } = useTranslation()
  const isSettingsOpen = useChatStore((s) => s.isSettingsOpen)
  const setIsSettingsOpen = useChatStore((s) => s.setIsSettingsOpen)
  const updateSettings = useChatStore((s) => s.updateSettings)

  const handleResetSettings = useCallback(() => {
    updateSettings({
      autoScroll: true,
      streamMode: true,
      showSources: true,
      showIntent: true,
    })
    toast.success(t('settings.settingsReset'))
  }, [updateSettings, t])

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden max-h-[85vh] dialog-entrance">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">{t('settings.title')}</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {t('settings.subtitle')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="flex-1 overflow-hidden">
          <div className="px-6 pt-2">
            <TabsList className="w-full grid grid-cols-7 h-auto p-1">
              <TabsTrigger value="profile" className="text-xs py-1.5 gap-1">
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('settings.account')}</span>
              </TabsTrigger>
              <TabsTrigger value="model" className="text-xs py-1.5 gap-1">
                <Bot className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('settings.model')}</span>
              </TabsTrigger>
              <TabsTrigger value="chat" className="text-xs py-1.5 gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('settings.chat')}</span>
              </TabsTrigger>
              <TabsTrigger value="shortcuts" className="text-xs py-1.5 gap-1">
                <Keyboard className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('settings.shortcuts')}</span>
              </TabsTrigger>
              <TabsTrigger value="data" className="text-xs py-1.5 gap-1">
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('settings.data')}</span>
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="text-xs py-1.5 gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('settings.knowledge')}</span>
              </TabsTrigger>
              <TabsTrigger value="about" className="text-xs py-1.5 gap-1">
                <Info className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('settings.about')}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="max-h-[55vh]">
            <div className="px-6 pb-6 pt-3">
              {/* Profile Tab */}
              <TabsContent value="profile" className="mt-0 space-y-4">
                <ProfileSection />
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    {t('settings.usage')}
                  </h3>
                  <UsageSection />
                </div>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500" />
                    {t('settings.tokenUsage')}
                  </h3>
                  <TokenUsageSection />
                </div>
              </TabsContent>

              {/* Model / API Config Tab */}
              <TabsContent value="model" className="mt-0 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    {t('settings.apiConfig')}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {t('settings.apiConfigDesc')}
                  </p>
                  <ApiConfigSection />
                </div>
              </TabsContent>

              {/* Chat Settings Tab */}
              <TabsContent value="chat" className="mt-0 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    {t('settings.chatSettings')}
                  </h3>
                  <ChatSettingsSection />
                </div>
                <Separator />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={handleResetSettings}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  {t('settings.resetSettings')}
                </Button>
              </TabsContent>

              {/* Shortcuts Tab */}
              <TabsContent value="shortcuts" className="mt-0">
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Keyboard className="h-4 w-4 text-primary" />
                    {t('settings.shortcuts')}
                  </h3>
                  <ShortcutsSection />
                </div>
              </TabsContent>

              {/* Data Management Tab */}
              <TabsContent value="data" className="mt-0">
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    {t('settings.dataManagement')}
                  </h3>
                  <DataManagementSection />
                </div>
              </TabsContent>

              {/* Knowledge Base Tab */}
              <TabsContent value="knowledge" className="mt-0">
                <KnowledgeTabContent />
              </TabsContent>

              {/* About Tab */}
              <TabsContent value="about" className="mt-0">
                <AboutSection />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>

        {/* Footer with version */}
        <div className="border-t px-6 py-2.5 bg-muted/20">
          <p className="text-[10px] text-muted-foreground/50 text-center">
            {t('settings.version')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
