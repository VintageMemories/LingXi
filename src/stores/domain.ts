'use client'

import { create } from 'zustand'

export interface DomainInfo {
    id: string
    name: string
    display_name: string
    icon: string
    description: string
}

interface DomainState {
    currentDomain: DomainInfo | null
    domains: DomainInfo[]

    setDomains: (domains: DomainInfo[]) => void
    setCurrentDomain: (domain: DomainInfo) => void
}

export const useDomainStore = create<DomainState>((set) => ({
    currentDomain: null,
    domains: [],

    setDomains: (domains) => set({ domains }),
    setCurrentDomain: (domain) => {
        const { useChatStore } = require('./chat')
        useChatStore.setState({ messages: [] })
        const { useSessionStore } = require('./session-store')
        useSessionStore.setState({ sessionId: null })
        set({ currentDomain: domain })
    },
}))