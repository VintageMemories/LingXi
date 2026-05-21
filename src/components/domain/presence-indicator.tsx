'use client'

import { useChatStore, type PresenceUser } from '../../stores/chat'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { motion, AnimatePresence } from 'framer-motion'
import { Users } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

function getInitials(name: string): string {
  return name.slice(0, 1).toUpperCase()
}

function getRandomColor(userId: string): string {
  const colors = [
    'from-emerald-400 to-emerald-600',
    'from-amber-400 to-amber-600',
    'from-rose-400 to-rose-600',
    'from-violet-400 to-violet-600',
    'from-sky-400 to-sky-600',
    'from-orange-400 to-orange-600',
    'from-pink-400 to-pink-600',
    'from-teal-400 to-teal-600',
  ]
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function UserAvatar({ user, size = 'sm' }: { user: PresenceUser; size?: 'sm' | 'md' }) {
  const isSm = size === 'sm'
  return (
      <Avatar className={`${isSm ? 'h-5 w-5' : 'h-6 w-6'} ring-1 ring-background`}>
        <AvatarFallback
            className={`bg-gradient-to-br ${getRandomColor(user.userId)} text-white ${isSm ? 'text-[8px]' : 'text-[9px]'} font-medium`}
        >
          {getInitials(user.userName)}
        </AvatarFallback>
      </Avatar>
  )
}

export function PresenceIndicator() {
  const { t } = useTranslation()
  const activeUsers = useChatStore((s) => s.activeUsers)
  const typingUsers = useChatStore((s) => s.typingUsers)
  const sessionId = useChatStore((s) => s.sessionId)

  if (!sessionId) return null

  return (
      <div className="flex items-center gap-2">
        {activeUsers.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1.5">
                {activeUsers.slice(0, 3).map((user) => (
                    <motion.div
                        key={user.userId}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.2 }}
                    >
                      <UserAvatar user={user} size="sm" />
                    </motion.div>
                ))}
                {activeUsers.length > 3 && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[8px] font-medium text-muted-foreground ring-1 ring-background">
                      +{activeUsers.length - 3}
                    </div>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
            <Users className="h-2.5 w-2.5" />
                {t('presence.viewing', { count: activeUsers.length })}
          </span>
            </div>
        )}

        <AnimatePresence>
          {typingUsers.length > 0 && (
              <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-1.5 text-[11px] text-primary/70"
              >
                <div className="flex items-center gap-0.5">
                  <span className="typing-dot-enhanced h-1.5 w-1.5" />
                  <span className="typing-dot-enhanced h-1.5 w-1.5" />
                  <span className="typing-dot-enhanced h-1.5 w-1.5" />
                </div>
                <span>
              {typingUsers.length === 1
                  ? t('presence.typingOne', { name: typingUsers[0].userName })
                  : typingUsers.length === 2
                      ? t('presence.typingTwo', { name1: typingUsers[0].userName, name2: typingUsers[1].userName })
                      : t('presence.typingMany', { name: typingUsers[0].userName, count: typingUsers.length })
              }
            </span>
              </motion.div>
          )}
        </AnimatePresence>
      </div>
  )
}