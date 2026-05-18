'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  BookOpen,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Scale,
  TrendingUp,
  Database,
  Loader2,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n'

interface KnowledgeEntry {
  id: string
  title: string
  domain: string
  category: string | null
  source: string
  createdAt: string
}

interface KnowledgeResponse {
  entries: KnowledgeEntry[]
  total: number
  page: number
  limit: number
  totalPages: number
  countsByDomain: Record<string, number>
}

const domainBadgeColors: Record<string, string> = {
  medical: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  legal: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  finance: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
}

export function KnowledgeManager({
                                   open,
                                   onOpenChange,
                                 }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [countsByDomain, setCountsByDomain] = useState<Record<string, number>>({})
  const [domain, setDomain] = useState('all')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeEntry | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; totalEntries: number } | null>(null)

  const limit = 20

  const domainTabs = [
    { key: 'all', labelKey: 'knowledge.all', icon: <Database className="h-3.5 w-3.5" /> },
    { key: 'medical', labelKey: 'knowledge.medical', icon: <Stethoscope className="h-3.5 w-3.5" /> },
    { key: 'legal', labelKey: 'knowledge.legal', icon: <Scale className="h-3.5 w-3.5" /> },
    { key: 'finance', labelKey: 'knowledge.finance', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  ]

  const domainLabelKeys: Record<string, string> = {
    medical: 'knowledge.medical',
    legal: 'knowledge.legal',
    finance: 'knowledge.finance',
  }

  const fetchEntries = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (domain && domain !== 'all') params.set('domain', domain)
      if (search) params.set('search', search)

      const res = await fetch(`/api/knowledge?${params}`)
      if (!res.ok) {
        toast.error(t('knowledge.fetchFailed'))
        return
      }
      const data: KnowledgeResponse = await res.json()
      setEntries(data.entries)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setCountsByDomain(data.countsByDomain)
    } catch {
      toast.error(t('knowledge.networkError'))
    } finally {
      setIsLoading(false)
    }
  }, [page, domain, search, t])

  useEffect(() => {
    if (open) {
      fetchEntries()
    }
  }, [open, fetchEntries])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch('/api/knowledge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      if (!res.ok) {
        toast.error(t('knowledge.deleteFailed'))
        return
      }
      toast.success(t('knowledge.deleteSuccess', { title: deleteTarget.title }))
      setDeleteTarget(null)
      fetchEntries()
    } catch {
      toast.error(t('knowledge.deleteFailedRetry'))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDomainChange = (newDomain: string) => {
    setDomain(newDomain)
    setPage(1)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncResult(null)
    try {
      const syncDomain = domain === 'all' ? 'medical' : domain
      const res = await fetch('/api/knowledge/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: syncDomain }),
      })
      if (!res.ok) {
        toast.error(t('knowledge.syncFailed'))
        return
      }
      const data = await res.json()
      setSyncResult({
        success: true,
        message: data.message,
        totalEntries: data.totalEntries,
      })
      toast.success(t('knowledge.syncSuccess', { count: data.totalEntries }))
    } catch {
      toast.error(t('knowledge.syncFailed'))
    } finally {
      setIsSyncing(false)
    }
  }

  return (
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-[720px] p-0 gap-0 overflow-hidden max-h-[85vh]">
            {/* Header */}
            <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg">{t('knowledge.management')}</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                      {t('knowledge.manageDescription', { count: total })}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
            </div>

            {/* Domain tabs + Search */}
            <div className="px-6 pb-3 space-y-3">
              {/* Domain filter tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                {domainTabs.map((tab) => (
                    <Button
                        key={tab.key}
                        variant={domain === tab.key ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleDomainChange(tab.key)}
                    >
                      {tab.icon}
                      {t(tab.labelKey)}
                      <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                        {tab.key === 'all' ? total : (countsByDomain[tab.key] || 0)}
                      </Badge>
                    </Button>
                ))}
              </div>

              {/* Search + Sync */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                      type="text"
                      placeholder={t('knowledge.searchPlaceholder')}
                      value={search}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="h-8 rounded-lg border bg-background pl-8 text-sm placeholder:text-muted-foreground/50"
                  />
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs shrink-0"
                    onClick={handleSync}
                    disabled={isSyncing}
                >
                  {isSyncing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : syncResult?.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {isSyncing ? t('knowledge.syncing') : t('knowledge.syncKnowledge')}
                </Button>
              </div>

              {/* Sync result indicator */}
              {syncResult?.success && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{t('knowledge.indexRebuilt')} · {syncResult.totalEntries} {t('knowledge.all')}</span>
                  </div>
              )}
            </div>

            <Separator />

            {/* Table */}
            <ScrollArea className="max-h-[50vh]">
              <div className="px-6 py-3">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="mb-2 h-6 w-6 animate-spin text-primary" />
                      <p className="text-xs">{t('knowledge.loading')}</p>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <BookOpen className="mb-2 h-8 w-8 opacity-30" />
                      <p className="text-xs">{t('knowledge.noResults')}</p>
                    </div>
                ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40%]">{t('knowledge.columnTitle')}</TableHead>
                          <TableHead className="w-[15%]">{t('knowledge.columnDomain')}</TableHead>
                          <TableHead className="w-[15%]">{t('knowledge.columnCategory')}</TableHead>
                          <TableHead className="w-[15%]">{t('knowledge.columnSource')}</TableHead>
                          <TableHead className="w-[15%] text-right">{t('knowledge.columnActions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="text-sm truncate max-w-[250px]" title={entry.title}>
                                {entry.title}
                              </TableCell>
                              <TableCell>
                                <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 border ${domainBadgeColors[entry.domain] || 'bg-muted text-muted-foreground border-border'}`}
                                >
                                  {domainLabelKeys[entry.domain] ? t(domainLabelKeys[entry.domain]) : entry.domain}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {entry.category || '-'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {entry.source}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => setDeleteTarget(entry)}
                                    aria-label={t('knowledge.delete')}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                )}
              </div>
            </ScrollArea>

            {/* Pagination */}
            {totalPages > 1 && (
                <>
                  <Separator />
                  <div className="px-6 py-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t('knowledge.pageInfo', { page, totalPages, total })}
                </span>
                    <div className="flex items-center gap-2">
                      <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page <= 1}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setPage(Math.min(totalPages, page + 1))}
                          disabled={page >= totalPages}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('knowledge.confirmDelete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('knowledge.confirmDeleteMessage', { title: deleteTarget?.title || '' })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>{t('knowledge.cancelDelete')}</AlertDialogCancel>
              <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      {t('knowledge.deleting')}
                    </>
                ) : (
                    t('knowledge.confirmDeleteButton')
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
  )
}