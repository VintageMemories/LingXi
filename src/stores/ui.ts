'use client'

import { create } from 'zustand'

function loadSidebarOpen(): boolean {
    if (typeof window === 'undefined') return false
    try {
        const raw = localStorage.getItem('lingxi_sidebar_open')
        if (raw !== null) return raw === 'true'
    } catch {}
    return false
}

function saveSidebarOpen(open: boolean) {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem('lingxi_sidebar_open', String(open))
    } catch {}
}

export interface SearchMatch {
    messageId: string
    matchIndex: number
}

interface UIState {
    sidebarOpen: boolean
    isSettingsOpen: boolean
    isAboutOpen: boolean
    isShortcutsOpen: boolean
    isStatsOpen: boolean
    isSubscriptionOpen: boolean
    isActivateOpen: boolean
    isSearchOpen: boolean
    searchQuery: string
    searchMatches: SearchMatch[]
    currentMatchIndex: number

    setSidebarOpen: (open: boolean) => void
    toggleSidebar: () => void
    setIsSettingsOpen: (open: boolean) => void
    setIsAboutOpen: (open: boolean) => void
    setIsShortcutsOpen: (open: boolean) => void
    setIsStatsOpen: (open: boolean) => void
    setIsSubscriptionOpen: (open: boolean) => void
    setIsActivateOpen: (open: boolean) => void
    setIsSearchOpen: (open: boolean) => void
    setSearchQuery: (query: string) => void
    navigateMatch: (direction: 'next' | 'prev') => void
}

export const useUIStore = create<UIState>((set, get) => ({
    sidebarOpen: typeof window !== 'undefined' ? loadSidebarOpen() : false,
    isSettingsOpen: false,
    isAboutOpen: false,
    isShortcutsOpen: false,
    isStatsOpen: false,
    isSubscriptionOpen: false,
    isActivateOpen: false,
    isSearchOpen: false,
    searchQuery: '',
    searchMatches: [],
    currentMatchIndex: -1,

    setSidebarOpen: (open) => {
        saveSidebarOpen(open)
        set({ sidebarOpen: open })
    },

    toggleSidebar: () => {
        const next = !get().sidebarOpen
        saveSidebarOpen(next)
        set({ sidebarOpen: next })
    },

    setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
    setIsAboutOpen: (open) => set({ isAboutOpen: open }),
    setIsShortcutsOpen: (open) => set({ isShortcutsOpen: open }),
    setIsStatsOpen: (open) => set({ isStatsOpen: open }),
    setIsSubscriptionOpen: (open) => set({ isSubscriptionOpen: open }),
    setIsActivateOpen: (open) => set({ isActivateOpen: open }),

    setIsSearchOpen: (open) => {
        if (!open) {
            set({ isSearchOpen: false, searchQuery: '', searchMatches: [], currentMatchIndex: -1 })
        } else {
            set({ isSearchOpen: true })
        }
    },

    setSearchQuery: (query) => {
        if (!query.trim()) {
            set({ searchQuery: query, searchMatches: [], currentMatchIndex: -1 })
            return
        }
        const state = get()
        const { useChatStore } = require('./chat')
        const messages = useChatStore.getState().messages
        const matches: SearchMatch[] = []
        const lowerQuery = query.toLowerCase()
        messages.forEach((msg: any) => {
            const lowerContent = msg.content.toLowerCase()
            let searchFrom = 0
            while (true) {
                const idx = lowerContent.indexOf(lowerQuery, searchFrom)
                if (idx === -1) break
                matches.push({ messageId: msg.id, matchIndex: idx })
                searchFrom = idx + 1
            }
        })
        const newIndex = matches.length > 0 ? 0 : -1
        set({ searchQuery: query, searchMatches: matches, currentMatchIndex: newIndex })
    },

    navigateMatch: (direction) => {
        const state = get()
        if (state.searchMatches.length === 0) return
        let newIndex: number
        if (direction === 'next') {
            newIndex = (state.currentMatchIndex + 1) % state.searchMatches.length
        } else {
            newIndex = state.currentMatchIndex <= 0
                ? state.searchMatches.length - 1
                : state.currentMatchIndex - 1
        }
        set({ currentMatchIndex: newIndex })
    },
}))