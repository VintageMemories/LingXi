'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useChatStore, type UserInfo } from '@/stores/chat-store'
import { useTranslation } from '@/lib/i18n'
import { Loader2, Mail, Lock, User, Sparkles } from 'lucide-react'

export function AuthDialog() {
  const { t } = useTranslation()
  const isAuthDialogOpen = useChatStore((s) => s.isAuthDialogOpen)
  const setIsAuthDialogOpen = useChatStore((s) => s.setIsAuthDialogOpen)
  const setUser = useChatStore((s) => s.setUser)

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: loginEmail,
          password: loginPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('auth.loginFailed'))
        return
      }

      const userInfo: UserInfo = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        plan: data.user.plan,
      }
      setUser(userInfo)
      localStorage.setItem('lingxi_token', data.token)
      localStorage.setItem('lingxi_user', JSON.stringify(userInfo))
      setIsAuthDialogOpen(false)

      setLoginEmail('')
      setLoginPassword('')
      setError('')
    } catch {
      setError(t('auth.networkError'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (registerPassword !== registerConfirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }

    if (registerPassword.length < 6) {
      setError(t('auth.passwordTooShort'))
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          email: registerEmail,
          password: registerPassword,
          name: registerName,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('auth.registerFailed'))
        return
      }

      const userInfo: UserInfo = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        plan: data.user.plan,
      }
      setUser(userInfo)
      localStorage.setItem('lingxi_token', data.token)
      localStorage.setItem('lingxi_user', JSON.stringify(userInfo))
      setIsAuthDialogOpen(false)

      setRegisterName('')
      setRegisterEmail('')
      setRegisterPassword('')
      setRegisterConfirmPassword('')
      setError('')
    } catch {
      setError(t('auth.networkError'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsAuthDialogOpen(open)
    if (!open) {
      setError('')
    }
  }

  return (
      <Dialog open={isAuthDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden">
          {/* Header with gradient */}
          <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-3 mb-2"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogHeader>
                  <DialogTitle className="text-lg">{t('auth.welcome')}</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    {t('auth.welcomeDesc')}
                  </DialogDescription>
                </DialogHeader>
              </div>
            </motion.div>
          </div>

          {/* Tabs */}
          <div className="px-6 pb-6">
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'login' | 'register'); setError('') }}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">{t('auth.login')}</TabsTrigger>
                <TabsTrigger value="register">{t('auth.register')}</TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm">{t('auth.email')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                          id="login-email"
                          type="email"
                          placeholder="your@email.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="pl-9"
                          required
                          disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm">{t('auth.password')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                          id="login-password"
                          type="password"
                          placeholder={t('auth.passwordPlaceholder')}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="pl-9"
                          required
                          disabled={isLoading}
                      />
                    </div>
                  </div>

                  {error && (
                      <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2"
                      >
                        {error}
                      </motion.p>
                  )}

                  <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-primary-foreground"
                      disabled={isLoading}
                  >
                    {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('auth.loggingIn')}
                        </>
                    ) : (
                        t('auth.login')
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Register Tab */}
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="register-name" className="text-sm">{t('auth.nickname')}</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                          id="register-name"
                          type="text"
                          placeholder={t('auth.nicknamePlaceholder')}
                          value={registerName}
                          onChange={(e) => setRegisterName(e.target.value)}
                          className="pl-9"
                          disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-sm">{t('auth.email')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                          id="register-email"
                          type="email"
                          placeholder="your@email.com"
                          value={registerEmail}
                          onChange={(e) => setRegisterEmail(e.target.value)}
                          className="pl-9"
                          required
                          disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-sm">{t('auth.password')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                          id="register-password"
                          type="password"
                          placeholder={t('auth.passwordMinLength')}
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          className="pl-9"
                          required
                          minLength={6}
                          disabled={isLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm-password" className="text-sm">{t('auth.confirmPassword')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                          id="register-confirm-password"
                          type="password"
                          placeholder={t('auth.confirmPasswordPlaceholder')}
                          value={registerConfirmPassword}
                          onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                          className="pl-9"
                          required
                          minLength={6}
                          disabled={isLoading}
                      />
                    </div>
                  </div>

                  {error && (
                      <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2"
                      >
                        {error}
                      </motion.p>
                  )}

                  <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-primary-foreground"
                      disabled={isLoading}
                  >
                    {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('auth.registering')}
                        </>
                    ) : (
                        t('auth.register')
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
  )
}