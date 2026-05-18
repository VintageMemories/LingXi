'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/i18n'
import type { Source } from '@/stores/chat-store'

interface SourceReferenceProps {
    sources: Source[]
    sourceHint?: string | null
}

export function SourceReference({ sources, sourceHint }: SourceReferenceProps) {
    const { t } = useTranslation()
    const [expanded, setExpanded] = useState(false)

    if ((!sources || sources.length === 0) && !sourceHint) return null

    return (
        <div className="mt-2">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 text-xs text-primary transition-colors hover:text-primary/80"
            >
                {sources.length > 0 ? (
                    <>
                        <span>📋 {t('sources.sourceCount', { count: sources.length })}</span>
                        {expanded ? (
                            <ChevronUp className="h-3 w-3" />
                        ) : (
                            <ChevronDown className="h-3 w-3" />
                        )}
                    </>
                ) : (
                    <span>ℹ️ {sourceHint}</span>
                )}
            </button>

            {expanded && sources.length > 0 && (
                <div className="mt-2 space-y-1.5 rounded-lg border bg-muted/30 p-3 animate-fade-in">
                    {sources.map((source, index) => (
                        <div
                            key={index}
                            className="flex items-start gap-2 text-xs"
                        >
                            <Badge variant="secondary" className="flex-shrink-0 px-1.5 py-0 text-[10px]">
                                {index + 1}
                            </Badge>
                            <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-foreground/90">{source.title}</span>
                                <span className="flex items-center gap-1 text-muted-foreground">
                  <ExternalLink className="h-2.5 w-2.5" />
                                    {source.source}
                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}