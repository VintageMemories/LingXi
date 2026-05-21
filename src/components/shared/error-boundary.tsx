'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslation } from '@/lib/i18n'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
          onGoHome={this.handleGoHome}
        />
      )
    }

    return this.props.children
  }
}

interface ErrorFallbackProps {
  error: Error | null
  errorInfo: React.ErrorInfo | null
  onRetry: () => void
  onGoHome: () => void
}

function ErrorFallback({ error, errorInfo, onRetry, onGoHome }: ErrorFallbackProps) {
  const { t } = useTranslation()
  const isDev = process.env.NODE_ENV === 'development'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex min-h-screen items-center justify-center p-4 bg-background"
      >
        <Card className="w-full max-w-lg border-border/50 shadow-lg">
          <CardContent className="p-6 sm:p-8">
            {/* Error icon with animation */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, duration: 0.5, type: 'spring', stiffness: 200 }}
              className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
            >
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </motion.div>

            {/* Error message */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-center mb-6"
            >
              <h2 className="text-xl font-bold mb-2">
                {t('errors.somethingWrong')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('errors.errorDescription')}
              </p>
            </motion.div>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="flex items-center justify-center gap-3 mb-6"
            >
              <Button
                onClick={onRetry}
                className="gap-2"
                size="default"
              >
                <RefreshCw className="h-4 w-4" />
                {t('errors.retry')}
              </Button>
              <Button
                variant="outline"
                onClick={onGoHome}
                className="gap-2"
                size="default"
              >
                <Home className="h-4 w-4" />
                {t('errors.goHome')}
              </Button>
            </motion.div>

            {/* Error details in development mode */}
            {isDev && error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="rounded-lg border border-destructive/20 bg-destructive/5 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Bug className="h-4 w-4 text-destructive" />
                  <span className="text-xs font-semibold text-destructive">
                    {t('errors.devMode')}
                  </span>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground/70 mb-1">{t('errors.errorMessage')}</p>
                    <pre className="text-xs text-destructive/90 bg-background/80 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all">
                      {error.message}
                    </pre>
                  </div>
                  {errorInfo && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground/70 mb-1">{t('errors.componentStack')}</p>
                      <pre className="text-[10px] text-muted-foreground/80 bg-background/80 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
