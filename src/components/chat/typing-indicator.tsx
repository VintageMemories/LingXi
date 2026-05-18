'use client'

import { motion } from 'framer-motion'
import { useTranslation } from '@/lib/i18n'

export function TypingIndicator() {
    const { t } = useTranslation()

    return (
        <div className="flex items-center gap-2 px-1 py-2">
            <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                    <motion.span
                        key={i}
                        className="inline-block h-2 w-2 rounded-full bg-primary/50"
                        animate={{
                            y: [0, -6, 0],
                            opacity: [0.4, 1, 0.4],
                            scale: [0.85, 1, 0.85],
                        }}
                        transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: i * 0.15,
                            ease: 'easeInOut',
                        }}
                    />
                ))}
            </div>
            <span className="text-xs text-muted-foreground/50 animate-pulse">
        {t('messages.thinking')}
      </span>
        </div>
    )
}