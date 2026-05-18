/**
 * 领域配置加载器
 * 从领域包中导入配置，支持热切换
 */

import { medicalConfig } from '@/domains/medical/config';
import { legalConfig } from '@/domains/legal/config';
import { financeConfig } from '@/domains/finance/config';

export interface DomainConfig {
    domain: {
        id: string;
        name: string;
        display_name: string;
        icon: string;
        theme: string;
        description: string;
    };
    retrieval: {
        strategy: 'bm25' | 'vector' | 'hybrid';
        bm25_weight: number;
        vector_weight: number;
        top_k: number;
        rrf_k: number;
        sources: Array<{ name: string; weight: number; enabled: boolean }>;
    };
    intents: Array<{
        id: string;
        priority: number;
        keywords: string[];
        skip_llm?: boolean;
        subscription: string;
        stream_tools?: boolean;
        use_rag?: boolean;
        tools?: string[];
    }>;
    tools: Array<{
        name: string;
        class: string;
        stream_support: boolean;
        description: string;
    }>;
    safety: {
        forbidden_terms: string[];
        emergency_terms: string[];
    };
    prompts: Record<string, string>;
    subscription: Record<string, {
        daily_limit: number;
        intents: string[];
    }>;
    welcome: {
        title: string;
        subtitle: string;
        suggestions: string[];
    };
}

const domainRegistry: Record<string, DomainConfig> = {
    medical: medicalConfig as DomainConfig,
    legal: legalConfig as DomainConfig,
    finance: financeConfig as DomainConfig,
};

let currentDomain = 'medical';

export function getCurrentDomain(): DomainConfig {
    return domainRegistry[currentDomain];
}

export function getDomainConfig(domainId: string): DomainConfig | null {
    return domainRegistry[domainId] || null;
}

export function getAllDomains(): Array<{
    id: string;
    name: string;
    display_name: string;
    icon: string;
    description: string;
}> {
    return Object.values(domainRegistry).map(config => ({
        id: config.domain.id,
        name: config.domain.name,
        display_name: config.domain.display_name,
        icon: config.domain.icon,
        description: config.domain.description,
    }));
}

export function switchDomain(domainId: string): boolean {
    if (domainRegistry[domainId]) {
        currentDomain = domainId;
        return true;
    }
    return false;
}

export function getCurrentDomainId(): string {
    return currentDomain;
}