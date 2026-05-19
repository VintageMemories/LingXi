/**
 * 领域配置加载器 (动态版本)
 * 领域列表和默认领域从后端 /api/domains 获取，
 * 欢迎语和建议从 i18n 翻译文件中动态读取。
 */

export interface DomainSummary {
    id: string;
    name: string;
    display_name: string;
    icon: string;
    description: string;
}

let cachedDomains: DomainSummary[] = [];
let currentDomainId = 'medical';

export async function fetchDomains(): Promise<DomainSummary[]> {
    try {
        const res = await fetch('/api/domains');
        if (!res.ok) throw new Error('Failed to fetch domains');
        const data = await res.json();
        cachedDomains = data.domains || [];
        if (data.default) {
            currentDomainId = data.default;
        }
        return cachedDomains;
    } catch (e) {
        console.error('[DomainConfig] 获取领域列表失败:', e);
        return cachedDomains;
    }
}

export function getCachedDomains(): DomainSummary[] {
    return cachedDomains;
}

export function getCurrentDomainId(): string {
    return currentDomainId;
}

export function setCurrentDomainId(id: string): void {
    currentDomainId = id;
}