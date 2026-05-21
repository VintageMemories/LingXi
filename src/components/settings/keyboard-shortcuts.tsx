'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useChatStore } from '../../stores/chat'
import { useTranslation } from '@/lib/i18n'
import { Keyboard } from 'lucide-react'

interface ShortcutItem {
  keys: string[]
  descriptionKey: string
  categoryKey: string
}

const shortcuts: ShortcutItem[] = [
  { keys: ['Ctrl', 'B'], descriptionKey: 'keyboard.toggleSidebar', categoryKey: 'keyboard.navigation' },
  { keys: ['Ctrl', 'Shift', 'N'], descriptionKey: 'keyboard.newChat', categoryKey: 'keyboard.navigation' },
  { keys: ['Ctrl', 'F'], descriptionKey: 'keyboard.searchMessages', categoryKey: 'keyboard.navigation' },
  { keys: ['Ctrl', '/'], descriptionKey: 'keyboard.shortcutPanel', categoryKey: 'keyboard.navigation' },
  { keys: ['Enter'], descriptionKey: 'keyboard.sendMessage', categoryKey: 'keyboard.input' },
  { keys: ['Shift', 'Enter'], descriptionKey: 'keyboard.newLine', categoryKey: 'keyboard.input' },
  { keys: ['Escape'], descriptionKey: 'keyboard.closePopup', categoryKey: 'keyboard.general' },
]

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
      <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md border border-border bg-muted/80 shadow-[0_1px_0_1px_rgba(0,0,0,0.06)] text-[11px] font-mono text-muted-foreground whitespace-nowrap">
        {children}
      </kbd>
  )
}

export function KeyboardShortcutsPanel() {
  const { t } = useTranslation()
  const isShortcutsOpen = useChatStore((s) => s.isShortcutsOpen)
  const setIsShortcutsOpen = useChatStore((s) => s.setIsShortcutsOpen)

  const categoryKeys = Array.from(new Set(shortcuts.map((s) => s.categoryKey)))

  return (
      <Dialog open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                  <Keyboard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg">{t('keyboard.title')}</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    {t('keyboard.subtitle')}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Shortcuts list */}
          <div className="px-6 pb-6 space-y-4">
            {categoryKeys.map((categoryKey) => (
                <div key={categoryKey}>
                  <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2">
                    {t(categoryKey)}
                  </h3>
                  <div className="space-y-1.5">
                    {shortcuts
                        .filter((s) => s.categoryKey === categoryKey)
                        .map((shortcut) => (
                            <div
                                key={shortcut.descriptionKey}
                                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors"
                            >
                      <span className="text-sm text-foreground/80">
                        {t(shortcut.descriptionKey)}
                      </span>
                              <div className="flex items-center gap-1">
                                {shortcut.keys.map((key, i) => (
                                    <span key={i} className="flex items-center gap-1">
                            <KbdKey>{key}</KbdKey>
                                      {i < shortcut.keys.length - 1 && (
                                          <span className="text-[10px] text-muted-foreground/40">+</span>
                                      )}
                          </span>
                                ))}
                              </div>
                            </div>
                        ))}
                  </div>
                </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
  )
}