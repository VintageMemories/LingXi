'use client'

import { create } from 'zustand'

export interface UserInfo {
    id: string
    email: string
    name: string
    plan: string
    avatar?: string
}

export interface TokenUsage {
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

const TOKEN_USAGE_KEY = 'lingxi_token_usage'

function loadTotalTokenUsage(): TokenUsage {
    if (typeof window === 'undefined') return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    try {
        const stored = localStorage.getItem(TOKEN_USAGE_KEY)
        if (stored) return JSON.parse(stored) as TokenUsage
    } catch {}
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
}

function saveTotalTokenUsage(usage: TokenUsage) {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(TOKEN_USAGE_KEY, JSON.stringify(usage))
    } catch {}
}

interface UserState {
    user: UserInfo | null
    isAuthDialogOpen: boolean
    totalTokenUsage: TokenUsage

    setUser: (user: UserInfo | null) => void
    setIsAuthDialogOpen: (open: boolean) => void
    logout: () => void
    addTokenUsage: (usage: { promptTokens: number; completionTokens: number; model?: string }) => void
    resetTokenUsage: () => void
}

export const useUserStore = create<UserState>((set, get) => ({
    user: null,
    isAuthDialogOpen: false,
    totalTokenUsage: loadTotalTokenUsage(),

    setUser: (user) => {
        set({ user })
        if (user?.id) {
            fetch(`/api/auth/token-usage?userId=${user.id}`)
                .then(r => r.json())
                .then(data => {
                    if (data.tokenUsage) {
                        set({ totalTokenUsage: data.tokenUsage })
                    }
                })
                .catch(() => {})
        }
    },

    setIsAuthDialogOpen: (open) => set({ isAuthDialogOpen: open }),

    logout: () => {
        set({ user: null })
        if (typeof window !== 'undefined') {
            localStorage.removeItem('lingxi_token')
            localStorage.removeItem('lingxi_user')
        }
    },

    addTokenUsage: (usage) => {
        set((state) => {
            const newTotal: TokenUsage = {
                promptTokens: state.totalTokenUsage.promptTokens + usage.promptTokens,
                completionTokens: state.totalTokenUsage.completionTokens + usage.completionTokens,
                totalTokens: state.totalTokenUsage.totalTokens + usage.promptTokens + usage.completionTokens,
            }
            saveTotalTokenUsage(newTotal)
            const userId = state.user?.id
            if (userId) {
                fetch('/api/auth/token-usage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, tokenUsage: usage }),
                }).catch(() => {})
            }
            return { totalTokenUsage: newTotal }
        })
    },

    resetTokenUsage: () => {
        const empty: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
        saveTotalTokenUsage(empty)
        const userId = get().user?.id
        if (userId) {
            fetch('/api/auth/token-usage', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            }).catch(() => {})
        }
        set({ totalTokenUsage: empty })
    },
}))