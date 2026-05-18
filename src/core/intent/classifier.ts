/**
 * 意图分类器
 */

import { DomainConfig } from '@/core/domain-config';

export interface IntentResult {
    intent: string;
    confidence: number;
    method: 'keyword' | 'llm' | 'fallback';
    needsRag: boolean;
    tools: string[];
    skipLlm: boolean;
    streamTools: boolean;
}

export function classifyByKeyword(query: string, domainConfig: DomainConfig): IntentResult | null {
    const intents = domainConfig.intents.sort((a, b) => a.priority - b.priority);

    for (const intent of intents) {
        if (!intent.keywords || intent.keywords.length === 0) continue;

        for (const keyword of intent.keywords) {
            if (query.includes(keyword)) {
                return {
                    intent: intent.id,
                    confidence: 0.7,
                    method: 'keyword',
                    needsRag: intent.use_rag || false,
                    tools: intent.tools || [],
                    skipLlm: intent.skip_llm || false,
                    streamTools: intent.stream_tools || false,
                };
            }
        }
    }

    return null;
}

export function needsLlmVerification(query: string, domainConfig: DomainConfig): boolean {
    if (query.length < 4) return false;

    const result = classifyByKeyword(query, domainConfig);
    if (result && result.intent === 'emergency') return false;
    if (result && result.intent === 'greeting') return false;

    return true;
}

export function getDefaultIntent(domainConfig: DomainConfig): IntentResult {
    const fallbackIntent = domainConfig.intents.find(
        i => i.id === `${domainConfig.domain.id}_query` || i.keywords.length === 0
    );

    if (fallbackIntent) {
        return {
            intent: fallbackIntent.id,
            confidence: 0.3,
            method: 'fallback',
            needsRag: fallbackIntent.use_rag || false,
            tools: fallbackIntent.tools || [],
            skipLlm: fallbackIntent.skip_llm || false,
            streamTools: fallbackIntent.stream_tools || false,
        };
    }

    return {
        intent: 'out_of_scope',
        confidence: 0.1,
        method: 'fallback',
        needsRag: false,
        tools: [],
        skipLlm: true,
        streamTools: false,
    };
}

export async function classifyIntent(
    query: string,
    domainConfig: DomainConfig,
    llmClassify?: (query: string, history: string) => Promise<string>
): Promise<IntentResult> {
    const keywordResult = classifyByKeyword(query, domainConfig);

    if (keywordResult && keywordResult.skipLlm) {
        return keywordResult;
    }

    if (!keywordResult && llmClassify) {
        try {
            const llmIntent = await llmClassify(query, '');

            const matchedIntent = domainConfig.intents.find(i => i.id === llmIntent);
            if (matchedIntent) {
                return {
                    intent: matchedIntent.id,
                    confidence: 0.85,
                    method: 'llm',
                    needsRag: matchedIntent.use_rag || false,
                    tools: matchedIntent.tools || [],
                    skipLlm: matchedIntent.skip_llm || false,
                    streamTools: matchedIntent.stream_tools || false,
                };
            }
        } catch (e) {
            console.error('[IntentClassifier] LLM复核失败:', e);
        }
    }

    return keywordResult || getDefaultIntent(domainConfig);
}