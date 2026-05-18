'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useChatStore } from '@/stores/chat-store'
import { useTranslation } from '@/lib/i18n'
import {
  Sparkles, Heart, Globe, Zap, Shield, Brain, Cpu, Database,
  BookOpen, GitBranch, FileText, Layers, Search, MessageSquare,
  ArrowRight, ExternalLink, Code2, Palette, Server, Workflow,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function AboutDialog() {
  const { t } = useTranslation()
  const isAboutOpen = useChatStore((s) => s.isAboutOpen)
  const setIsAboutOpen = useChatStore((s) => s.setIsAboutOpen)

  const features = [
    { icon: <Brain className="h-4 w-4" />, titleKey: 'about.featureHybridRAG', descKey: 'about.featureHybridRAGDesc' },
    { icon: <Globe className="h-4 w-4" />, titleKey: 'about.featureMultiDomain', descKey: 'about.featureMultiDomainDesc' },
    { icon: <Zap className="h-4 w-4" />, titleKey: 'about.featureSSE', descKey: 'about.featureSSEDesc' },
    { icon: <Shield className="h-4 w-4" />, titleKey: 'about.featureSafety', descKey: 'about.featureSafetyDesc' },
    { icon: <Search className="h-4 w-4" />, titleKey: 'about.featureIntent', descKey: 'about.featureIntentDesc' },
    { icon: <MessageSquare className="h-4 w-4" />, titleKey: 'about.featureFeedback', descKey: 'about.featureFeedbackDesc' },
    { icon: <Layers className="h-4 w-4" />, titleKey: 'about.featureConvMgmt', descKey: 'about.featureConvMgmtDesc' },
    { icon: <Workflow className="h-4 w-4" />, titleKey: 'about.featureAgent', descKey: 'about.featureAgentDesc' },
  ]

  const techStack = [
    { icon: <Code2 className="h-3.5 w-3.5" />, label: 'Next.js 16' },
    { icon: <FileText className="h-3.5 w-3.5" />, label: 'TypeScript 5' },
    { icon: <Database className="h-3.5 w-3.5" />, label: 'Prisma + SQLite' },
    { icon: <Palette className="h-3.5 w-3.5" />, label: 'Tailwind CSS 4' },
    { icon: <Server className="h-3.5 w-3.5" />, label: 'shadcn/ui' },
    { icon: <Zap className="h-3.5 w-3.5" />, label: 'SSE' },
    { icon: <Brain className="h-3.5 w-3.5" />, label: 'GPT-4o' },
    { icon: <Cpu className="h-3.5 w-3.5" />, label: 'Zustand' },
    { icon: <GitBranch className="h-3.5 w-3.5" />, label: 'Framer Motion' },
  ]

  const pipelineSteps = [
    { step: '1', labelKey: 'about.stepUserInput', detailKey: 'about.stepUserInputDetail' },
    { step: '2', labelKey: 'about.stepIntent', detailKey: 'about.stepIntentDetail' },
    { step: '3', labelKey: 'about.stepSafety', detailKey: 'about.stepSafetyDetail' },
    { step: '4', labelKey: 'about.stepRAG', detailKey: 'about.stepRAGDetail' },
    { step: '5', labelKey: 'about.stepAgent', detailKey: 'about.stepAgentDetail' },
    { step: '6', labelKey: 'about.stepOutput', detailKey: 'about.stepOutputDetail' },
  ]

  return (
      <Dialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
        <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden max-h-[85vh] overflow-y-auto">
          {/* Header with animated gradient */}
          <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-8 pb-6 text-center overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 animate-bg-pattern opacity-50" />

            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="relative"
            >
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg animate-float">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
            </motion.div>
            <DialogHeader className="relative">
              <DialogTitle className="text-xl font-bold">
                <span className="animate-gradient-text">{t('about.title')}</span>
                <span className="ml-2 text-sm font-normal text-muted-foreground">Lingxi</span>
              </DialogTitle>
              <DialogDescription className="text-sm">
                {t('about.subtitle')}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 flex items-center justify-center gap-2 relative">
              <Badge variant="outline" className="text-[10px] border-primary/20 text-primary/70">
                v1.0.0
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {t('about.openSource')}
              </Badge>
              <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                {t('about.knowledgeCount', { count: 228 })}
              </Badge>
            </div>
          </div>

          {/* Features */}
          <div className="px-6 py-4">
            <p className="text-[11px] font-medium text-muted-foreground/60 mb-3 text-center uppercase tracking-wider">
              {t('about.coreFeatures')}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {features.map((feature, index) => (
                  <motion.div
                      key={feature.titleKey}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + index * 0.05, duration: 0.3 }}
                  >
                    <Card className="border-border/40 bg-card/50 hover:border-primary/20 hover:bg-primary/5 transition-colors">
                      <CardContent className="p-3 text-center">
                        <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                          {feature.icon}
                        </div>
                        <p className="text-xs font-medium">{t(feature.titleKey)}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/70">{t(feature.descKey)}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Architecture Pipeline */}
          <div className="px-6 py-4">
            <p className="text-[11px] font-medium text-muted-foreground/60 mb-3 text-center uppercase tracking-wider">
              {t('about.techArchitecture')}
            </p>
            <div className="space-y-1.5">
              {pipelineSteps.map((step, index) => (
                  <motion.div
                      key={step.step}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.08, duration: 0.3 }}
                      className="flex items-center gap-3"
                  >
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {step.step}
                    </div>
                    <div className="flex-1 flex items-center gap-2 rounded-lg border border-border/30 bg-muted/20 px-3 py-1.5">
                      <span className="text-xs font-medium">{t(step.labelKey)}</span>
                      <span className="text-[10px] text-muted-foreground/60">{t(step.detailKey)}</span>
                    </div>
                    {index < pipelineSteps.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-primary/30 flex-shrink-0" />
                    )}
                  </motion.div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Tech Stack */}
          <div className="px-6 py-4">
            <p className="text-[11px] font-medium text-muted-foreground/60 mb-3 text-center uppercase tracking-wider">
              {t('about.techStack')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {techStack.map((tech) => (
                  <span
                      key={tech.label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/20 hover:text-primary/80"
                  >
                <span className="text-primary/60">{tech.icon}</span>
                    {tech.label}
              </span>
              ))}
            </div>
          </div>

          <Separator />

          {/* Links */}
          <div className="px-6 py-4">
            <p className="text-[11px] font-medium text-muted-foreground/60 mb-3 text-center uppercase tracking-wider">
              {t('about.links')}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs border-border/50"
                  onClick={() => window.open('https://github.com', '_blank')}
              >
                <GitBranch className="h-3.5 w-3.5" />
                GitHub
                <ExternalLink className="h-2.5 w-2.5" />
              </Button>
              <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs border-border/50"
                  onClick={() => window.open('https://docs.example.com', '_blank')}
              >
                <BookOpen className="h-3.5 w-3.5" />
                {t('about.docs')}
                <ExternalLink className="h-2.5 w-2.5" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Credits */}
          <div className="px-6 py-4 space-y-2 text-center">
            <p className="text-xs text-muted-foreground">
              {t('about.builtWith')}
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              {t('about.highlights')}
            </p>
            <div className="flex items-center justify-center gap-3 pt-1">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
              <Heart className="h-3 w-3 text-red-400" />
              {t('about.madeWithLove')}
            </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
  )
}