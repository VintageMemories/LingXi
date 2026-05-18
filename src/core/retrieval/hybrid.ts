/**
 * 混合检索引擎 - RRF融合
 */

import { BM25Retriever, getBM25Retriever, initBM25Index, clearBM25Index } from '@/core/retrieval/bm25';
import { VectorRetriever, getVectorRetriever, initVectorIndex, clearVectorIndex } from '@/core/retrieval/vector';
import { DomainConfig } from '@/core/domain-config';

export interface RetrievalResult {
    id: string;
    score: number;
    title: string;
    content: string;
    source?: string;
    category?: string;
    bm25Rank?: number;
    vectorRank?: number;
}

function rrfFusion(
    bm25Results: Array<{ id: string; score: number }>,
    vectorResults: Array<{ id: string; score: number }>,
    bm25Weight: number = 0.5,
    vectorWeight: number = 0.5,
    k: number = 60
): Map<string, number> {
    const scores = new Map<string, number>();

    bm25Results.forEach((result, rank) => {
        const score = bm25Weight * (1 / (k + rank + 1));
        scores.set(result.id, (scores.get(result.id) || 0) + score);
    });

    vectorResults.forEach((result, rank) => {
        const score = vectorWeight * (1 / (k + rank + 1));
        scores.set(result.id, (scores.get(result.id) || 0) + score);
    });

    return scores;
}

export class HybridRetriever {
    private bm25: BM25Retriever;
    private vector: VectorRetriever;
    private config: DomainConfig['retrieval'];

    constructor(domain: string, config: DomainConfig['retrieval']) {
        this.bm25 = getBM25Retriever(domain);
        this.vector = getVectorRetriever(domain);
        this.config = config;
    }

    search(query: string, topK?: number): RetrievalResult[] {
        const k = topK || this.config.top_k || 5;
        const searchK = k * 3;

        const bm25Results = this.bm25.search(query, searchK);
        const vectorResults = this.vector.search(query, searchK);

        if (this.config.strategy === 'bm25') {
            return bm25Results.slice(0, k).map(r => ({
                id: r.document.id,
                score: r.score,
                title: r.document.title,
                content: r.document.content,
                source: r.document.source,
                category: r.document.category,
            }));
        }

        if (this.config.strategy === 'vector') {
            return vectorResults.slice(0, k).map(r => ({
                id: r.document.id,
                score: r.score,
                title: r.document.title,
                content: r.document.content,
                source: r.document.source,
                category: r.document.category,
            }));
        }

        const fusedScores = rrfFusion(
            bm25Results.map(r => ({ id: r.id, score: r.score })),
            vectorResults.map(r => ({ id: r.id, score: r.score })),
            this.config.bm25_weight,
            this.config.vector_weight,
            this.config.rrf_k || 60
        );

        const sortedIds = Array.from(fusedScores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, k);

        const allDocs = new Map<string, RetrievalResult>();

        for (const r of bm25Results) {
            allDocs.set(r.id, {
                id: r.document.id,
                score: 0,
                title: r.document.title,
                content: r.document.content,
                source: r.document.source,
                category: r.document.category,
                bm25Rank: bm25Results.indexOf(r) + 1,
            });
        }

        for (const r of vectorResults) {
            const existing = allDocs.get(r.id);
            if (existing) {
                existing.vectorRank = vectorResults.indexOf(r) + 1;
            } else {
                allDocs.set(r.id, {
                    id: r.document.id,
                    score: 0,
                    title: r.document.title,
                    content: r.document.content,
                    source: r.document.source,
                    category: r.document.category,
                    vectorRank: vectorResults.indexOf(r) + 1,
                });
            }
        }

        return sortedIds.map(([id, score]) => ({
            ...allDocs.get(id)!,
            score,
        })).filter(Boolean);
    }
}

const hybridRetrieverCache = new Map<string, HybridRetriever>();

export function getHybridRetriever(domain: string, config: DomainConfig['retrieval']): HybridRetriever {
    if (!hybridRetrieverCache.has(domain)) {
        hybridRetrieverCache.set(domain, new HybridRetriever(domain, config));
    }
    return hybridRetrieverCache.get(domain)!;
}

export async function initAllIndices(domain: string): Promise<void> {
    await Promise.all([
        initBM25Index(domain),
        initVectorIndex(domain),
    ]);
    console.log(`[Retrieval] 领域 ${domain} 所有索引初始化完成`);
}

export async function search(
    query: string,
    domainConfig: DomainConfig,
    topK?: number
): Promise<RetrievalResult[]> {
    const domain = domainConfig.domain.id;
    const retriever = getHybridRetriever(domain, domainConfig.retrieval);
    return retriever.search(query, topK);
}

export async function reinitializeDomainIndex(domain: string): Promise<void> {
    clearBM25Index(domain);
    clearVectorIndex(domain);
    hybridRetrieverCache.delete(domain);

    await initAllIndices(domain);
    console.log(`[Retrieval] 领域 ${domain} 索引已重新初始化`);
}