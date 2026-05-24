'use client'

import { create } from 'zustand'

export interface Source {
    title: string
    source: string
}

export interface TokenUsage {
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    sources?: Source[]
    intent?: string
    confidence?: number
    feedback?: 1 | -1 | null
    timestamp: number
    isStreaming?: boolean
    statusBadges?: Array<{ type: 'tool_start' | 'retrieval_start'; message: string; tools?: string[] }>
    sourceHint?: string | null
    images?: string[]
    bookmarked?: boolean
    pinned?: boolean
    tokenUsage?: TokenUsage
}

export interface DomainInfo {
    id: string
    name: string
    display_name: string
    icon: string
    description: string
}

export interface SessionInfo {
    id: string
    domain: string
    title: string | null
    createdAt: string
    updatedAt: string
    messageCount?: number
    tags?: string[]
}

export interface UserInfo {
    id: string
    email: string
    name: string
    plan: string
    avatar?: string
}

export interface ChatSettings {
    autoScroll: boolean
    streamMode: boolean
    showSources: boolean
    showIntent: boolean
    apiProvider: string
    apiKey: string
    apiBaseUrl: string
    selectedModel: string
    apiKeys: Record<string, string>
    selectedModels: Record<string, string>
}

const SETTINGS_KEY = 'lingxi_settings'
const SIDEBAR_KEY = 'lingxi_sidebar_open'
const BOOKMARK_PREFIX = 'lingxi_bookmarks_'
const TOKEN_USAGE_KEY = 'lingxi_token_usage'

function loadSettings(): ChatSettings {
    const defaults: ChatSettings = {
        autoScroll: true, streamMode: true, showSources: true, showIntent: true,
        apiProvider: 'deepseek', apiKey: '', apiBaseUrl: '', selectedModel: '',
        apiKeys: {}, selectedModels: {}
    }
    if (typeof window === 'undefined') return defaults
    try {
        const raw = localStorage.getItem(SETTINGS_KEY)
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<ChatSettings>
            return {
                autoScroll: parsed.autoScroll ?? true,
                streamMode: parsed.streamMode ?? true,
                showSources: parsed.showSources ?? true,
                showIntent: parsed.showIntent ?? true,
                apiProvider: parsed.apiProvider ?? 'deepseek',
                apiKey: parsed.apiKeys?.[parsed.apiProvider ?? 'deepseek'] ?? parsed.apiKey ?? '',
                apiBaseUrl: parsed.apiBaseUrl ?? '',
                selectedModel: parsed.selectedModels?.[parsed.apiProvider ?? 'deepseek'] ?? parsed.selectedModel ?? '',
                apiKeys: parsed.apiKeys ?? {},
                selectedModels: parsed.selectedModels ?? {},
            }
        }
    } catch {}
    return defaults
}

function saveSettings(settings: ChatSettings) {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
        // ignore
    }
}

function loadTotalTokenUsage(): TokenUsage {
    if (typeof window === 'undefined') return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    try {
        const stored = localStorage.getItem(TOKEN_USAGE_KEY)
        if (stored) return JSON.parse(stored) as TokenUsage
    } catch {
        // ignore
    }
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0}
}

function saveTotalTokenUsage(usage: TokenUsage) {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(TOKEN_USAGE_KEY, JSON.stringify(usage))
    } catch {
        // ignore
    }
}

function loadSidebarOpen(): boolean {
    if (typeof window === 'undefined') return false
    try {
        const raw = localStorage.getItem(SIDEBAR_KEY)
        if (raw !== null) return raw === 'true'
    } catch {
        // ignore
    }
    return false
}

function saveSidebarOpen(open: boolean) {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(SIDEBAR_KEY, String(open))
    } catch {
        // ignore
    }
}

export interface SearchMatch {
    messageId: string
    matchIndex: number
}

export interface PresenceUser {
    userId: string
    userName: string
}

interface ChatState {
    messages: ChatMessage[]
    currentDomain: DomainInfo | null
    domains: DomainInfo[]
    sessionId: string | null
    isStreaming: boolean
    isListening: boolean
    uploadedImages: string[]
    sessions: SessionInfo[]
    isLoadingSessions: boolean
    isLoadingSession: boolean
    sidebarOpen: boolean
    user: UserInfo | null
    isAuthDialogOpen: boolean
    isSettingsOpen: boolean
    isAboutOpen: boolean
    isShortcutsOpen: boolean
    isStatsOpen: boolean
    isSubscriptionOpen: boolean
    isActivateOpen: boolean
    settings: ChatSettings
    isSearchOpen: boolean
    searchQuery: string
    searchMatches: SearchMatch[]
    currentMatchIndex: number
    isConnected: boolean
    lastResponseLatency: number | null
    currentModel: string
    activeUsers: PresenceUser[]
    typingUsers: PresenceUser[]
    totalTokenUsage: TokenUsage
    currentMode: string
    setCurrentMode: (mode: string) => void

    setDomains: (domains: DomainInfo[]) => void
    setCurrentDomain: (domain: DomainInfo) => void
    addMessage: (message: ChatMessage) => void
    updateMessage: (id: string, updates: Partial<ChatMessage>) => void
    appendToMessage: (id: string, text: string) => void
    setSessionId: (id: string | null) => void
    setIsStreaming: (streaming: boolean) => void
    setIsListening: (listening: boolean) => void
    setUploadedImages: (images: string[]) => void
    addUploadedImage: (image: string) => void
    removeUploadedImage: (index: number) => void
    clearChat: () => void
    clearImages: () => void
    setSessions: (sessions: SessionInfo[]) => void
    setIsLoadingSessions: (loading: boolean) => void
    setIsLoadingSession: (loading: boolean) => void
    setSidebarOpen: (open: boolean) => void
    toggleSidebar: () => void
    loadSession: (sessionId: string) => Promise<void>
    deleteSession: (sessionId: string) => Promise<void>
    startNewChat: () => void
    refreshSessions: () => Promise<void>
    setUser: (user: UserInfo | null) => void
    setIsAuthDialogOpen: (open: boolean) => void
    setIsSettingsOpen: (open: boolean) => void
    setIsAboutOpen: (open: boolean) => void
    setIsShortcutsOpen: (open: boolean) => void
    setIsStatsOpen: (open: boolean) => void
    setIsSubscriptionOpen: (open: boolean) => void
    setIsActivateOpen: (open: boolean) => void
    updateSettings: (settings: Partial<ChatSettings>) => void
    logout: () => void
    removeLastAssistantMessage: () => void
    renameSession: (sessionId: string, title: string) => Promise<void>
    toggleBookmark: (messageId: string) => void
    togglePin: (messageId: string) => void
    setIsSearchOpen: (open: boolean) => void
    setSearchQuery: (query: string) => void
    navigateMatch: (direction: 'next' | 'prev') => void
    setIsConnected: (connected: boolean) => void
    setLastResponseLatency: (latency: number | null) => void
    setCurrentModel: (model: string) => void
    setActiveUsers: (users: PresenceUser[]) => void
    setTypingUsers: (users: PresenceUser[]) => void
    addTokenUsage: (usage: { promptTokens: number; completionTokens: number; model?: string }) => void
    resetTokenUsage: () => void
    updateSessionTags: (sessionId: string, tags: string[]) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
    messages: [],
    currentDomain: null,
    domains: [],
    sessionId: null,
    isStreaming: false,
    isListening: false,
    uploadedImages: [],
    sessions: [],
    isLoadingSessions: false,
    isLoadingSession: false,
    sidebarOpen: false,
    user: null,
    isAuthDialogOpen: false,
    isSettingsOpen: false,
    isAboutOpen: false,
    isShortcutsOpen: false,
    isStatsOpen: false,
    isSubscriptionOpen: false,
    isActivateOpen: false,
    settings: loadSettings(),
    isSearchOpen: false,
    searchQuery: '',
    searchMatches: [],
    currentMatchIndex: -1,
    isConnected: true,
    lastResponseLatency: null,
    currentModel: '',
    activeUsers: [],
    typingUsers: [],
    totalTokenUsage: loadTotalTokenUsage(),
    currentMode: 'free',
    setCurrentMode: (mode) => set({ currentMode: mode }),

    setDomains: (domains) => set({ domains }),
    setCurrentDomain: (domain) => set({ currentDomain: domain, messages: [], sessionId: null }),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    updateMessage: (id, updates) =>
        set((state) => ({ messages: state.messages.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg)) })),
    appendToMessage: (id, text) =>
        set((state) => ({ messages: state.messages.map((msg) => (msg.id === id ? { ...msg, content: msg.content + text } : msg)) })),
    setSessionId: (id) => {
        set({ sessionId: id })
        if (id) get().refreshSessions()
    },
    setIsStreaming: (streaming) => set({ isStreaming: streaming }),
    setIsListening: (listening) => set({ isListening: listening }),
    setUploadedImages: (images) => set({ uploadedImages: images }),
    addUploadedImage: (image) => set((state) => ({ uploadedImages: [...state.uploadedImages, image] })),
    removeUploadedImage: (index) =>
        set((state) => ({ uploadedImages: state.uploadedImages.filter((_, i) => i !== index) })),
    clearChat: () => set({ messages: [], sessionId: null }),
    clearImages: () => set({ uploadedImages: [] }),
    setSessions: (sessions) => set({ sessions }),
    setIsLoadingSessions: (loading) => set({ isLoadingSessions: loading }),
    setSidebarOpen: (open) => {
        saveSidebarOpen(open)
        set({ sidebarOpen: open })
    },
    toggleSidebar: () => {
        const next = !get().sidebarOpen
        saveSidebarOpen(next)
        set({ sidebarOpen: next })
    },
    setIsLoadingSession: (loading) => set({ isLoadingSession: loading }),
    loadSession: async (sessionId: string) => {
        set({ isLoadingSession: true })
        try {
            const res = await fetch(`/api/sessions/${sessionId}`)
            if (!res.ok) return
            const data = await res.json()
            console.log('[loadSession] API 返回数据:', JSON.stringify({ session: data.session, messagesCount: data.messages?.length }))

            let bookmarkedIds: string[] = []
            let pinnedIds: string[] = []
            if (typeof window !== 'undefined') {
                try {
                    const storedBookmarks = localStorage.getItem(`${BOOKMARK_PREFIX}${sessionId}`)
                    if (storedBookmarks) bookmarkedIds = JSON.parse(storedBookmarks) as string[]
                } catch {}
                try {
                    const storedPins = localStorage.getItem(`lingxi_pinned_${sessionId}`)
                    if (storedPins) pinnedIds = JSON.parse(storedPins) as string[]
                } catch {}
            }

            const rawMessages = (data.messages || []) as Array<{
                id: string; role: string; content: string; intent?: string | null;
                sources?: string | null; createdAt: string; feedbackRating?: number | null;
            }>
            const messages: ChatMessage[] = rawMessages
                .map((m) => {
                    let sources: Source[] | undefined
                    if (m.sources) {
                        try {
                            sources = JSON.parse(m.sources)
                        } catch {
                            console.warn(`[loadSession] 解析 sources 失败 (id=${m.id})，已忽略`)
                        }
                    }
                    return {
                        id: m.id,
                        role: (m.role === 'assistant' || m.role === 'user') ? m.role as 'user' | 'assistant' : 'assistant',
                        content: m.content || '',
                        intent: m.intent || undefined,
                        sources,
                        timestamp: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
                        feedback: (m.feedbackRating === 1 || m.feedbackRating === -1) ? m.feedbackRating as 1 | -1 : null,
                        bookmarked: bookmarkedIds.includes(m.id),
                        pinned: pinnedIds.includes(m.id),
                    } as ChatMessage
                })
                .filter((m) => m && m.content) // 滤掉异常消息

            // 优先从已加载的领域列表匹配，若未加载则用会话自带字段临时构造
            let sessionDomain: DomainInfo | null = get().domains.find(
                (d) => d.id === data.session?.domain
            ) ?? null

            if (!sessionDomain && data.session?.domain) {
                sessionDomain = {
                    id: data.session.domain,
                    name: data.session.domain,
                    display_name: data.session.domain,
                    icon: '🤖',
                    description: '',
                }
            }

            console.log('[loadSession] 消息数量:', messages.length, '会话ID:', sessionId)
            if (messages.length > 0) {
                console.log('[loadSession] 第一条消息:', messages[0].content.substring(0, 50))
            }
            set({
                currentDomain: sessionDomain,
                sessionId,
                messages,
                sidebarOpen: false,
                isLoadingSession: false
            })
        } catch (error) {
            console.error('Failed to load session:', error)
            set({ isLoadingSession: false })
        }
    },
    deleteSession: async (sessionId: string) => {
        try {
            await fetch('/api/sessions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId }),
            })
            if (get().sessionId === sessionId) {
                set({ messages: [], sessionId: null })
            }
            await get().refreshSessions()
        } catch (error) {
            console.error('Failed to delete session:', error)
        }
    },
    startNewChat: () => {
        set({ messages: [], sessionId: null, sidebarOpen: false })
    },
    refreshSessions: async () => {
        set({ isLoadingSessions: true })
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('lingxi_token') : ''
            // 始终带上 token，后端解析失败时会自动忽略，同时还会查询 userId 为空的匿名会话
            const headers: Record<string, string> = { 'Authorization': token ? `Bearer ${token}` : '' }
            const res = await fetch('/api/sessions', { headers })
            if (res.ok) {
                const data = await res.json()
                let localStorageTags: Record<string, string[]> = {}
                if (typeof window !== 'undefined') {
                    try {
                        const storedTags = localStorage.getItem('lingxi_session_tags')
                        if (storedTags) localStorageTags = JSON.parse(storedTags) as Record<string, string[]>
                    } catch {}
                }
                const sessions = (data.sessions || []).map((s: SessionInfo) => ({
                    ...s,
                    tags: s.tags || localStorageTags[s.id] || undefined,
                }))
                set({ sessions })
            }
        } catch (error) {
            console.error('Failed to refresh sessions:', error)
        } finally {
            set({ isLoadingSessions: false })
        }
    },
    setUser: (user) => {
        set({ user, currentMode: user?.plan || 'free' })
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
    setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
    setIsAboutOpen: (open) => set({ isAboutOpen: open }),
    setIsShortcutsOpen: (open) => set({ isShortcutsOpen: open }),
    setIsStatsOpen: (open) => set({ isStatsOpen: open }),
    setIsSubscriptionOpen: (open) => set({ isSubscriptionOpen: open }),
    setIsActivateOpen: (open) => set({ isActivateOpen: open }),
    updateSettings: (partial) => {
        const state = get()
        const nextSettings = { ...state.settings, ...partial }

        // 当模型被更新时，同步保存到 selectedModels（按供应商分组），防止刷新丢失
        if (partial.selectedModel !== undefined) {
            const provider = nextSettings.apiProvider || 'deepseek'
            nextSettings.selectedModels = {
                ...nextSettings.selectedModels,
                [provider]: partial.selectedModel,
            }
        }

        saveSettings(nextSettings)
        set({
            settings: nextSettings,
            currentModel: partial.selectedModel ?? state.currentModel
        })
    },
    logout: () => {
        set({ user: null, currentMode: 'free' })
        if (typeof window !== 'undefined') {
            localStorage.removeItem('lingxi_token')
            localStorage.removeItem('lingxi_user')
        }
    },
    removeLastAssistantMessage: () => {
        const messages = get().messages
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
                set({ messages: messages.filter((_, idx) => idx !== i) })
                return
            }
        }
    },
    renameSession: async (sessionId: string, title: string) => {
        try {
            const res = await fetch(`/api/sessions/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title }),
            })
            if (!res.ok) return
            await get().refreshSessions()
        } catch (error) {
            console.error('Failed to rename session:', error)
        }
    },
    toggleBookmark: (messageId: string) => {
        set((state) => {
            const newMessages = state.messages.map((msg) =>
                msg.id === messageId ? { ...msg, bookmarked: !msg.bookmarked } : msg
            )
            if (typeof window !== 'undefined' && state.sessionId) {
                try {
                    const bookmarkedIds = newMessages.filter((msg) => msg.bookmarked).map((msg) => msg.id)
                    localStorage.setItem(`${BOOKMARK_PREFIX}${state.sessionId}`, JSON.stringify(bookmarkedIds))
                } catch {}
            }
            return { messages: newMessages }
        })
    },
    togglePin: (messageId: string) => {
        set((state) => {
            const newMessages = state.messages.map((msg) =>
                msg.id === messageId ? { ...msg, pinned: !msg.pinned } : msg
            )
            if (typeof window !== 'undefined' && state.sessionId) {
                try {
                    const pinnedIds = newMessages.filter((msg) => msg.pinned).map((msg) => msg.id)
                    localStorage.setItem(`lingxi_pinned_${state.sessionId}`, JSON.stringify(pinnedIds))
                } catch {}
            }
            return { messages: newMessages }
        })
    },
    setIsSearchOpen: (open: boolean) => {
        if (!open) {
            set({ isSearchOpen: false, searchQuery: '', searchMatches: [], currentMatchIndex: -1 })
        } else {
            set({ isSearchOpen: true })
        }
    },
    setSearchQuery: (query: string) => {
        if (!query.trim()) {
            set({ searchQuery: query, searchMatches: [], currentMatchIndex: -1 })
            return
        }
        const state = get()
        const matches: SearchMatch[] = []
        const lowerQuery = query.toLowerCase()
        state.messages.forEach((msg) => {
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
    navigateMatch: (direction: 'next' | 'prev') => {
        const state = get()
        if (state.searchMatches.length === 0) return
        let newIndex: number
        if (direction === 'next') {
            newIndex = (state.currentMatchIndex + 1) % state.searchMatches.length
        } else {
            newIndex = state.currentMatchIndex <= 0 ? state.searchMatches.length - 1 : state.currentMatchIndex - 1
        }
        set({ currentMatchIndex: newIndex })
    },
    setIsConnected: (connected) => set({ isConnected: connected }),
    setLastResponseLatency: (latency) => set({ lastResponseLatency: latency }),
    setCurrentModel: (model) => set({ currentModel: model }),
    setActiveUsers: (users) => set({ activeUsers: users }),
    setTypingUsers: (users) => set({ typingUsers: users }),
    addTokenUsage: (usage) => {
        set((state) => {
            const newTotal: TokenUsage = {
                promptTokens: state.totalTokenUsage.promptTokens + usage.promptTokens,
                completionTokens: state.totalTokenUsage.completionTokens + usage.completionTokens,
                totalTokens: state.totalTokenUsage.totalTokens + usage.promptTokens + usage.completionTokens,
            }
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
    updateSessionTags: async (sessionId: string, tags: string[]) => {
        try {
            const res = await fetch(`/api/sessions/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tags }),
            })
            if (!res.ok) return
            set((state) => ({
                sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, tags } : s)),
            }))
            if (typeof window !== 'undefined') {
                try {
                    const storedTags = localStorage.getItem('lingxi_session_tags')
                    const allTags = storedTags ? (JSON.parse(storedTags) as Record<string, string[]>) : {}
                    allTags[sessionId] = tags
                    localStorage.setItem('lingxi_session_tags', JSON.stringify(allTags))
                } catch {}
            }
        } catch (error) {
            console.error('Failed to update session tags:', error)
        }
    },
}))