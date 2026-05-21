'use client'

import { create } from 'zustand'

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
    } catch {}
}

interface SettingsState {
    settings: ChatSettings
    currentModel: string
    updateSettings: (partial: Partial<ChatSettings>) => void
    setCurrentModel: (model: string) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    settings: loadSettings(),
    currentModel: '',

    updateSettings: (partial) => {
        const state = get()
        const nextSettings = { ...state.settings, ...partial }

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

    setCurrentModel: (model) => set({ currentModel: model }),
}))