'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ChevronDown, Zap } from 'lucide-react'
import { useChatStore, type DomainInfo } from '@/stores/chat-store'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import { useTranslation } from '@/lib/i18n'

const domainDescriptionKeys: Record<string, string> = {
  medical: 'domains.medicalDesc',
  legal: 'domains.legalDesc',
  finance: 'domains.financeDesc',
}

export function DomainSelector() {
  const { t } = useTranslation()
  const currentDomain = useChatStore((s) => s.currentDomain)
  const domains = useChatStore((s) => s.domains)
  const setDomains = useChatStore((s) => s.setDomains)
  const setCurrentDomain = useChatStore((s) => s.setCurrentDomain)

  // Fetch domains on mount
  useEffect(() => {
    async function loadDomains() {
      try {
        const res = await fetch('/api/domains')
        const data = await res.json()
        if (data.domains) {
          const domainInfos: DomainInfo[] = data.domains.map(
              (d: { id: string; name: string; display_name: string; icon: string; description: string }) => ({
                id: d.id,
                name: d.name,
                display_name: d.display_name,
                icon: d.icon,
                description: d.description,
              })
          )
          setDomains(domainInfos)

          const defaultId = data.default || 'medical'
          const defaultDomain = domainInfos.find((d) => d.id === defaultId)
          if (defaultDomain && !useChatStore.getState().currentDomain) {
            setCurrentDomain(defaultDomain)
          }
        }
      } catch (error) {
        console.error('Failed to fetch domains:', error)
      }
    }
    loadDomains()
  }, [setDomains, setCurrentDomain])

  const handleSelect = (domain: DomainInfo) => {
    setCurrentDomain(domain)
  }

  if (!currentDomain) return null

  return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
              variant="ghost"
              className="h-9 gap-1.5 px-3 text-sm font-medium border border-border/50 rounded-md hover:bg-primary/5 transition-all duration-200 mb-1"
          >
            <AnimatePresence mode="wait">
              <motion.span
                  key={currentDomain.id}
                  initial={{ opacity: 0, scale: 0.8, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 4 }}
                  transition={{ duration: 0.2 }}
                  className="text-base"
              >
                {currentDomain.icon}
              </motion.span>
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <motion.span
                  key={currentDomain.id + '-name'}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2 }}
              >
                {currentDomain.name}
              </motion.span>
            </AnimatePresence>
            <ChevronDown className="h-3.5 w-3.5 opacity-50 transition-transform duration-200" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 p-2" sideOffset={4}>
          {domains.map((domain) => (
              <DropdownMenuItem
                  key={domain.id}
                  onClick={() => handleSelect(domain)}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                      currentDomain.id === domain.id
                          ? 'bg-primary/5 border border-primary/10'
                          : 'hover:bg-muted/50'
                  }`}
              >
                <span className="text-xl mt-0.5">{domain.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{domain.name}</span>
                    {currentDomain.id === domain.id && (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-normal">
                          {t('domains.current')}
                        </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {t(domainDescriptionKeys[domain.id] || '') || domain.display_name}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Zap className="h-2.5 w-2.5 text-primary/60" />
                    <span className="text-[10px] text-muted-foreground/60">
                  RAG + Agent
                </span>
                  </div>
                </div>
              </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
  )
}