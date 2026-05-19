'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChatStore, type SessionInfo } from '@/stores/chat-store'
import { useTranslation } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Plus,
  MessageSquare,
  Trash2,
  Stethoscope,
  Scale,
  TrendingUp,
  X,
  Search,
  Pencil,
  Tag,
} from 'lucide-react'
import { toast } from 'sonner'

const domainIcons: Record<string, React.ReactNode> = {
  medical: <Stethoscope className="h-3.5 w-3.5" />,
  legal: <Scale className="h-3.5 w-3.5" />,
  finance: <TrendingUp className="h-3.5 w-3.5" />,
}

const domainColors: Record<string, string> = {
  medical: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  legal: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  finance: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
}

const TAG_OPTIONS = [
  { key: 'tagImportant', color: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20' },
  { key: 'tagTodo', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  { key: 'tagStudy', color: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/20' },
  { key: 'tagWork', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { key: 'tagFavorite', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20' },
] as const

function getTagColor(tag: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  for (const opt of TAG_OPTIONS) {
    if (t(`sidebar.${opt.key}`) === tag) {
      return opt.color
    }
  }
  return 'bg-muted text-muted-foreground border-border'
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
  if (diffDays < 30) return t('sidebar.weeksAgo', { count: Math.floor(diffDays / 7) })
  if (diffDays < 365) return t('sidebar.monthsAgo', { count: Math.floor(diffDays / 30) })
  return t('sidebar.yearsAgo', { count: Math.floor(diffDays / 365) })
}

function getDateGroup(dateStr: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays === 0) return t('sidebar.today')
  if (diffDays === 1) return t('sidebar.yesterday')
  if (diffDays < 7) return t('sidebar.recent7Days')
  return t('sidebar.earlier')
}

function groupSessionsByDate(sessions: SessionInfo[], t: (key: string, params?: Record<string, string | number>) => string): { label: string; sessions: SessionInfo[] }[] {
  const groups = new Map<string, SessionInfo[]>()

  for (const session of sessions) {
    const group = getDateGroup(session.updatedAt, t)
    if (!groups.has(group)) {
      groups.set(group, [])
    }
    groups.get(group)!.push(session)
  }

  const order = [t('sidebar.today'), t('sidebar.yesterday'), t('sidebar.recent7Days'), t('sidebar.earlier')]
  const result: { label: string; sessions: SessionInfo[] }[] = []

  for (const label of order) {
    const groupSessions = groups.get(label)
    if (groupSessions && groupSessions.length > 0) {
      result.push({ label, sessions: groupSessions })
    }
  }

  return result
}

function TagSelector({
                       sessionId,
                       currentTags,
                       onTagsUpdate,
                     }: {
  sessionId: string
  currentTags: string[]
  onTagsUpdate: (tags: string[]) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const handleToggle = useCallback((tagName: string, checked: boolean) => {
    const newTags = checked
        ? [...currentTags, tagName]
        : currentTags.filter(t => t !== tagName)
    onTagsUpdate(newTags)
  }, [currentTags, onTagsUpdate])

  return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-primary"
              onClick={(e) => e.stopPropagation()}
              aria-label={t('sidebar.setTag')}
          >
            <Tag className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
            className="w-40 p-2"
            align="start"
            onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-1 mb-1.5">{t('sidebar.selectTags')}</p>
            {TAG_OPTIONS.map((tag) => {
              const tagName = t(`sidebar.${tag.key}`)
              const isChecked = currentTags.includes(tagName)
              return (
                  <label
                      key={tag.key}
                      className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => handleToggle(tagName, !!checked)}
                        className="h-3.5 w-3.5"
                    />
                    <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 border ${tag.color}`}
                    >
                      {tagName}
                    </Badge>
                  </label>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
  )
}

function SessionItem({
                       session,
                       isActive,
                       onSelect,
                       onDelete,
                       onRename,
                       onTagsUpdate,
                       isBatchMode,
                       isSelected,
                       onToggleSelect,
                     }: {
  session: SessionInfo
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (sessionId: string, title: string) => void
  onTagsUpdate: (sessionId: string, tags: string[]) => void
  isBatchMode: boolean
  isSelected: boolean
  onToggleSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  const [isHovering, setIsHovering] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const title = session.title || t('sidebar.newConversationTitle')
  const icon = domainIcons[session.domain] || <MessageSquare className="h-3.5 w-3.5" />
  const colorClass = domainColors[session.domain] || 'bg-muted text-muted-foreground'
  const tags = session.tags || []

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditTitle(session.title || '')
    setIsEditing(true)
  }

  const saveEdit = () => {
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== (session.title || '')) {
      onRename(session.id, trimmed)
    }
    setIsEditing(false)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditTitle('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  const handleTagsUpdate = useCallback((newTags: string[]) => {
    onTagsUpdate(session.id, newTags)
  }, [session.id, onTagsUpdate])

  return (
      <motion.div
          layout
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10, height: 0 }}
          transition={{ duration: 0.2 }}
          onClick={isBatchMode ? () => onToggleSelect(session.id) : (isEditing ? undefined : onSelect)}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className={`group relative flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer ${
              isActive && !isBatchMode
                  ? 'bg-primary/10 border-l-2 border-l-primary'
                  : isBatchMode && isSelected
                      ? 'bg-primary/5 border-l-2 border-l-primary'
                      : 'hover:bg-muted/50 border-l-2 border-l-transparent'
          }`}
      >
        {isBatchMode && (
            <Checkbox
                checked={isSelected}
                className="mt-1 h-4 w-4"
                onClick={(e) => e.stopPropagation()}
            />
        )}
        <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${colorClass}`}>
          {icon}
        </div>
        <div className="flex-1 overflow-hidden">
          {isEditing ? (
              <Input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={handleKeyDown}
                  className="h-6 rounded-md border-primary/30 bg-background px-2 text-sm focus-visible:ring-1 focus-visible:ring-primary/50"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
              />
          ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <p className={`truncate text-sm ${isActive && !isBatchMode ? 'font-medium text-foreground' : 'text-foreground/80'}`}>
                    {title}
                  </p>
                  {session.messageCount !== undefined && session.messageCount > 0 && (
                      <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] leading-none">
                        {session.messageCount}
                      </Badge>
                  )}
                </div>
                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tags.map((tag) => (
                          <Badge
                              key={tag}
                              variant="outline"
                              className={`text-[9px] px-1 py-0 h-4 border ${getTagColor(tag, t)}`}
                          >
                            {tag}
                          </Badge>
                      ))}
                    </div>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                  {getRelativeTime(session.updatedAt, t)}
                </p>
              </>
          )}
        </div>
        {!isBatchMode && (
            <AnimatePresence>
              {isHovering && !isEditing && (
                  <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-shrink-0 gap-0.5"
                  >
                    <TagSelector
                        sessionId={session.id}
                        currentTags={tags}
                        onTagsUpdate={handleTagsUpdate}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                        onClick={startEditing}
                        aria-label={t('sidebar.renameSession')}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete()
                        }}
                        aria-label={t('sidebar.deleteSession')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </motion.div>
              )}
            </AnimatePresence>
        )}
      </motion.div>
  )
}

export function ConversationSidebar() {
  const { t } = useTranslation()
  const sessions = useChatStore((s) => s.sessions)
  const sessionId = useChatStore((s) => s.sessionId)
  const sidebarOpen = useChatStore((s) => s.sidebarOpen)
  const isLoadingSessions = useChatStore((s) => s.isLoadingSessions)
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen)
  const loadSession = useChatStore((s) => s.loadSession)
  const deleteSession = useChatStore((s) => s.deleteSession)
  const renameSession = useChatStore((s) => s.renameSession)
  const startNewChat = useChatStore((s) => s.startNewChat)
  const refreshSessions = useChatStore((s) => s.refreshSessions)
  const updateSessionTags = useChatStore((s) => s.updateSessionTags)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBatchMode, setIsBatchMode] = useState(false)

  useEffect(() => {
    refreshSessions()
  }, [refreshSessions])

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions
    const query = searchQuery.trim().toLowerCase()
    if (query.startsWith('#')) {
      const tagQuery = query.slice(1)
      if (!tagQuery) return sessions
      return sessions.filter((session) => {
        const sessionTags = (session.tags || []).map(t => t.toLowerCase())
        return sessionTags.some(t => t.includes(tagQuery))
      })
    }
    return sessions.filter((session) => {
      const title = (session.title || t('sidebar.newConversationTitle')).toLowerCase()
      return title.includes(query)
    })
  }, [sessions, searchQuery, t])

  const groupedSessions = useMemo(() => groupSessionsByDate(filteredSessions, t), [filteredSessions, t])

  const handleNewChat = () => {
    setSearchQuery('')
    setSelectedIds(new Set())
    setIsBatchMode(false)
    startNewChat()
  }

  const handleTagsUpdate = useCallback(async (sessionId: string, tags: string[]) => {
    await updateSessionTags(sessionId, tags)
    toast.success(tags.length > 0 ? t('sidebar.tagsUpdated', { tags: tags.join(', ') }) : t('sidebar.tagsCleared'))
  }, [updateSessionTags, t])

  const handleBackdropClick = () => {
    setSidebarOpen(false)
  }

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleBatchDelete = useCallback(async () => {
    for (const id of selectedIds) {
      await deleteSession(id)
    }
    setSelectedIds(new Set())
    setIsBatchMode(false)
    toast.success(`已删除 ${selectedIds.size} 个对话`)
  }, [selectedIds, deleteSession])

  const sidebarContent = (
      <div className="flex h-full flex-col bg-card">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">{t('sidebar.chatHistory')}</h2>
          <div className="flex items-center gap-1">
            {isBatchMode ? (
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 -mr-1">
                  <h2
                      className="text-sm font-semibold tracking-tight cursor-pointer hover:text-primary transition-colors w-16"
                      onClick={() => {
                        setSelectedIds(prev => {
                          const allIds = new Set(filteredSessions.map(s => s.id))
                          if (prev.size === allIds.size) return new Set()
                          return allIds
                        })
                      }}
                  >
                    {selectedIds.size === filteredSessions.length ? '取消全选' : '全选'}
                  </h2>
                  <h2
                      className="text-sm font-semibold tracking-tight cursor-pointer hover:text-primary transition-colors"
                      onClick={() => {
                        setSelectedIds(prev => {
                          const allIds = new Set(filteredSessions.map(s => s.id))
                          const inverted = new Set<string>()
                          allIds.forEach(id => {
                            if (!prev.has(id)) inverted.add(id)
                          })
                          return inverted
                        })
                      }}
                  >
                    反选
                  </h2>
                  <h2
                      className={`text-sm font-semibold tracking-tight cursor-pointer transition-colors ${selectedIds.size === 0 ? 'text-muted-foreground/30 pointer-events-none' : 'text-red-500 hover:text-red-400'}`}
                      onClick={selectedIds.size === 0 ? undefined : handleBatchDelete}
                  >
                    删除({selectedIds.size})
                  </h2>
                  <h2
                      className="text-sm font-semibold tracking-tight cursor-pointer hover:text-primary transition-colors"
                      onClick={() => { setSelectedIds(new Set()); setIsBatchMode(false) }}
                  >
                    取消
                  </h2>
                </div>
            ) : (
                <h2
                    className="text-sm font-semibold tracking-tight cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setIsBatchMode(true)}
                >
                  {t('sidebar.batchDelete')}
                </h2>
            )}
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 lg:hidden"
                onClick={() => setSidebarOpen(false)}
                aria-label={t('sidebar.closeSidebar')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="px-3 pb-3">
          <Button
              onClick={handleNewChat}
              className="w-full gap-2 bg-primary/90 hover:bg-primary text-primary-foreground"
              size="sm"
          >
            <Plus className="h-4 w-4" />
            {t('sidebar.newChat')}
          </Button>
        </div>

        {/* Search Input */}
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
                type="text"
                placeholder={`${t('sidebar.searchPlaceholder')} (${t('sidebar.searchTagHint')})`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 rounded-lg border bg-background pl-8 pr-8 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/30"
            />
            {searchQuery && (
                <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    aria-label={t('sidebar.clearSearch')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
            )}
          </div>
        </div>

        <Separator />

        {/* Sessions List */}
        <ScrollArea className="flex-1 px-2 sidebar-scroll">
          <div className="py-2">
            {isLoadingSessions && sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-xs">{t('sidebar.loading')}</p>
                </div>
            ) : searchQuery.trim() && filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <div className="empty-state-illustration">
                    <span className="dot-1" />
                    <span className="dot-2" />
                    <span className="dot-3" />
                  </div>
                  <p className="text-xs">{t('sidebar.noResults')}</p>
                  <p className="mt-1 text-[11px] opacity-60">{t('sidebar.tryKeywords')}</p>
                </div>
            ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MessageSquare className="mb-2 h-8 w-8 opacity-30" />
                  <p className="text-xs">{t('sidebar.noConversations')}</p>
                  <p className="mt-1 text-[11px] opacity-60">{t('sidebar.startNewChat')}</p>
                </div>
            ) : (
                <AnimatePresence mode="popLayout">
                  {groupedSessions.map((group) => (
                      <div key={group.label} className="mb-2">
                        <div className="px-3 py-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                      {group.label}
                    </span>
                        </div>
                        <AnimatePresence mode="popLayout">
                          {group.sessions.map((session) => (
                              <SessionItem
                                  key={session.id}
                                  session={session}
                                  isActive={session.id === sessionId}
                                  onSelect={() => loadSession(session.id)}
                                  onDelete={() => deleteSession(session.id)}
                                  onRename={renameSession}
                                  onTagsUpdate={handleTagsUpdate}
                                  isBatchMode={isBatchMode}
                                  isSelected={selectedIds.has(session.id)}
                                  onToggleSelect={handleToggleSelect}
                              />
                          ))}
                        </AnimatePresence>
                      </div>
                  ))}
                </AnimatePresence>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <Separator />
        <div className="px-4 py-3">
          <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground/50">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {searchQuery.trim() ? `${filteredSessions.length} / ${sessions.length} ${t('sidebar.chatHistory')}` : t('sidebar.conversationCount', { count: sessions.length })}
          </span>
            <span>·</span>
            <span>{t('sidebar.version')}</span>
          </div>
        </div>
      </div>
  )

  return (
      <>
        <AnimatePresence mode="wait">
          {sidebarOpen && (
              <motion.aside
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 280, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  className="hidden lg:block h-full overflow-hidden border-r bg-card"
              >
                {sidebarContent}
              </motion.aside>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {sidebarOpen && (
              <>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
                    onClick={handleBackdropClick}
                />
                <motion.aside
                    initial={{ x: -280 }}
                    animate={{ x: 0 }}
                    exit={{ x: -280 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    className="fixed left-0 top-0 z-50 h-full w-[280px] shadow-xl lg:hidden"
                >
                  {sidebarContent}
                </motion.aside>
              </>
          )}
        </AnimatePresence>
      </>
  )
}