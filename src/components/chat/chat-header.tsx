'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon, PanelLeftOpen, PanelLeftClose, Plus, Sparkles, LogOut, User as UserIcon, Settings, Info, Keyboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { DomainSelector } from './domain-selector'
import { AuthDialog } from './auth-dialog'
import { SettingsDialog } from './settings-dialog'
import { AboutDialog } from './about-dialog'
import { KeyboardShortcutsPanel } from './keyboard-shortcuts'
import { PresenceIndicator } from './presence-indicator'
import { useChatStore } from '@/stores/chat-store'
import { useTranslation } from '@/lib/i18n'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { useState } from 'react'

export function ChatHeader() {
    const { theme, setTheme } = useTheme()
    const [isThemeSpinning, setIsThemeSpinning] = useState(false)
    const currentDomain = useChatStore((s) => s.currentDomain)
    const sidebarOpen = useChatStore((s) => s.sidebarOpen)
    const toggleSidebar = useChatStore((s) => s.toggleSidebar)
    const startNewChat = useChatStore((s) => s.startNewChat)
    const user = useChatStore((s) => s.user)
    const setIsAuthDialogOpen = useChatStore((s) => s.setIsAuthDialogOpen)
    const setIsSettingsOpen = useChatStore((s) => s.setIsSettingsOpen)
    const setIsAboutOpen = useChatStore((s) => s.setIsAboutOpen)
    const setIsShortcutsOpen = useChatStore((s) => s.setIsShortcutsOpen)
    const logout = useChatStore((s) => s.logout)

    const { t } = useTranslation()

    const getInitials = (name: string) => {
        return name.slice(0, 1).toUpperCase()
    }

    return (
        <>
            <header className="sticky top-0 z-30 w-full bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
                <div className="flex h-14 items-center justify-between px-4">
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={toggleSidebar}
                            aria-label={sidebarOpen ? t('header.closeSidebar') : t('header.openSidebar')}
                        >
                            {sidebarOpen ? (
                                <PanelLeftClose className="h-4 w-4" />
                            ) : (
                                <PanelLeftOpen className="h-4 w-4" />
                            )}
                        </Button>
                        <DomainSelector />
                    </div>

                    <button
                        className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-primary/5"
                        onClick={() => setIsAboutOpen(true)}
                        aria-label={t('header.aboutLingxi')}
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 animate-breathe">
                            <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-lg font-semibold tracking-tight">
              灵析
            </span>
                        <AnimatePresence mode="wait">
                            {currentDomain && (
                                <motion.span
                                    key={currentDomain.id}
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 4 }}
                                    transition={{ duration: 0.2 }}
                                    className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:inline-flex"
                                >
                                    · {currentDomain.name}
                                    <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse-online" />
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </button>

                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 ripple-effect"
                            onClick={startNewChat}
                            aria-label={t('header.newChat')}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                setIsThemeSpinning(true)
                                setTheme(theme === 'dark' ? 'light' : 'dark')
                                setTimeout(() => setIsThemeSpinning(false), 500)
                            }}
                            className={`h-9 w-9 ${isThemeSpinning ? 'theme-toggle-spinning' : ''}`}
                            aria-label={t('header.toggleTheme')}
                        >
                            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        </Button>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9"
                                    onClick={() => setIsShortcutsOpen(true)}
                                    aria-label={t('header.shortcuts')}
                                >
                                    <Keyboard className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{t('header.shortcutsHint')}</p>
                            </TooltipContent>
                        </Tooltip>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setIsSettingsOpen(true)}
                            aria-label={t('header.settings')}
                        >
                            <Settings className="h-4 w-4" />
                        </Button>

                        <div className="hidden sm:flex items-center">
                            <PresenceIndicator />
                        </div>

                        {user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="h-9 w-9 rounded-full p-0 ml-1"
                                        aria-label={t('header.profile')}
                                    >
                                        <Avatar className="h-8 w-8">
                                            {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                                            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground text-xs font-medium">
                                                {getInitials(user.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{user.name}</p>
                                            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="cursor-pointer" onClick={() => setIsSettingsOpen(true)}>
                                        <UserIcon className="mr-2 h-4 w-4" />
                                        {t('header.profile')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="cursor-pointer" onClick={() => setIsAboutOpen(true)}>
                                        <Info className="mr-2 h-4 w-4" />
                                        {t('header.aboutLingxi')}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="cursor-pointer text-destructive focus:text-destructive"
                                        onClick={logout}
                                    >
                                        <LogOut className="mr-2 h-4 w-4" />
                                        {t('header.logout')}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                className="ml-1 h-8 rounded-lg border-primary/30 text-primary hover:bg-primary/10 text-xs"
                                onClick={() => setIsAuthDialogOpen(true)}
                            >
                                {t('header.login')}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="header-gradient-line h-[2px] w-full" />
                <div className="h-1" />
            </header>

            <AuthDialog />
            <SettingsDialog />
            <AboutDialog />
            <KeyboardShortcutsPanel />
        </>
    )
}