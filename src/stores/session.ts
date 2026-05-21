'use client'

import { create } from 'zustand'

export interface Source {
    title: string
    source: string
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
    tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export interface PresenceUser {
    userId: string
    userName: string
}

interface ChatState {
    messages: ChatMessage[]
    isStreaming: boolean
    isListening: boolean
    uploadedImages: string[]
    isConnected: boolean
    lastResponseLatency: number | null
    activeUsers: PresenceUser[]
    typingUsers: PresenceUser[]

    addMessage: (message: ChatMessage) => void
    updateMessage: (id: string, updates: Partial<ChatMessage>) => void
    appendToMessage: (id: string, text: string) => void
    setMessages: (messages: ChatMessage[]) => void
    setIsStreaming: (streaming: boolean) => void
    setIsListening: (listening: boolean) => void
    setUploadedImages: (images: string[]) => void
    addUploadedImage: (image: string) => void
    removeUploadedImage: (index: number) => void
    clearImages: () => void
    removeLastAssistantMessage: () => void
    toggleBookmark: (messageId: string) => void
    togglePin: (messageId: string) => void
    setIsConnected: (connected: boolean) => void
    setLastResponseLatency: (latency: number | null) => void
    setActiveUsers: (users: PresenceUser[]) => void
    setTypingUsers: (users: PresenceUser[]) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
    messages: [],
    isStreaming: false,
    isListening: false,
    uploadedImages: [],
    isConnected: true,
    lastResponseLatency: null,
    activeUsers: [],
    typingUsers: [],

    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

    updateMessage: (id, updates) =>
        set((state) => ({
            messages: state.messages.map((msg) =>
                msg.id === id ? { ...msg, ...updates } : msg
            ),
        })),

    appendToMessage: (id, text) =>
        set((state) => ({
            messages: state.messages.map((msg) =>
                msg.id === id ? { ...msg, content: msg.content + text } : msg
            ),
        })),

    setMessages: (messages) => set({ messages }),

    setIsStreaming: (streaming) => set({ isStreaming: streaming }),
    setIsListening: (listening) => set({ isListening: listening }),

    setUploadedImages: (images) => set({ uploadedImages: images }),
    addUploadedImage: (image) =>
        set((state) => ({ uploadedImages: [...state.uploadedImages, image] })),
    removeUploadedImage: (index) =>
        set((state) => ({ uploadedImages: state.uploadedImages.filter((_, i) => i !== index) })),
    clearImages: () => set({ uploadedImages: [] }),

    removeLastAssistantMessage: () => {
        const messages = get().messages
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
                set({ messages: messages.filter((_, idx) => idx !== i) })
                return
            }
        }
    },

    toggleBookmark: (messageId: string) => {
        set((state) => {
            const newMessages = state.messages.map((msg) =>
                msg.id === messageId ? { ...msg, bookmarked: !msg.bookmarked } : msg
            )
            const sessionId = require('./session-store').useSessionStore.getState().sessionId
            if (typeof window !== 'undefined' && sessionId) {
                try {
                    const bookmarkedIds = newMessages
                        .filter((msg) => msg.bookmarked)
                        .map((msg) => msg.id)
                    localStorage.setItem(`lingxi_bookmarks_${sessionId}`, JSON.stringify(bookmarkedIds))
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
            const sessionId = require('./session-store').useSessionStore.getState().sessionId
            if (typeof window !== 'undefined' && sessionId) {
                try {
                    const pinnedIds = newMessages
                        .filter((msg) => msg.pinned)
                        .map((msg) => msg.id)
                    localStorage.setItem(`lingxi_pinned_${sessionId}`, JSON.stringify(pinnedIds))
                } catch {}
            }
            return { messages: newMessages }
        })
    },

    setIsConnected: (connected) => set({ isConnected: connected }),
    setLastResponseLatency: (latency) => set({ lastResponseLatency: latency }),
    setActiveUsers: (users) => set({ activeUsers: users }),
    setTypingUsers: (users) => set({ typingUsers: users }),
}))