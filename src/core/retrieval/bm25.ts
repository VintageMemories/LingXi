/**
 * BM25 检索引擎
 */

import { db } from '@/lib/db';

interface Document {
    id: string;
    title: string;
    content: string;
    category?: string;
    source?: string;
    [key: string]: unknown;
}

interface BM25Result {
    id: string;
    score: number;
    document: Document;
}

function tokenize(text: string): string[] {
    const cleaned = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ');
    const tokens: string[] = [];

    const chineseChars = cleaned.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const segment of chineseChars) {
        for (let i = 0; i < segment.length - 1; i++) {
            tokens.push(segment.substring(i, i + 2));
        }
        for (let i = 0; i < segment.length - 2; i++) {
            tokens.push(segment.substring(i, i + 3));
        }
        for (const char of segment) {
            tokens.push(char);
        }
    }

    const englishWords = cleaned.match(/[a-zA-Z0-9]+/g) || [];
    tokens.push(...englishWords.map(w => w.toLowerCase()));

    return [...new Set(tokens)];
}

export class BM25Retriever {
    private documents: Document[] = [];
    private docTokens: Map<string, string[]> = new Map();
    private idf: Map<string, number> = new Map();
    private avgDocLen: number = 0;

    private k1 = 1.5;
    private b = 0.75;

    addDocuments(docs: Document[]): void {
        this.documents = [...this.documents, ...docs];
        this._buildIndex();
    }

    setDocuments(docs: Document[]): void {
        this.documents = docs;
        this._buildIndex();
    }

    private _buildIndex(): void {
        this.docTokens.clear();
        this.idf.clear();

        let totalLen = 0;
        const df: Map<string, number> = new Map();

        for (const doc of this.documents) {
            const text = `${doc.title} ${doc.content} ${doc.category || ''}`;
            const tokens = tokenize(text);
            this.docTokens.set(doc.id, tokens);
            totalLen += tokens.length;

            const uniqueTokens = new Set(tokens);
            for (const token of uniqueTokens) {
                df.set(token, (df.get(token) || 0) + 1);
            }
        }

        this.avgDocLen = this.documents.length > 0 ? totalLen / this.documents.length : 0;

        const N = this.documents.length;
        for (const [token, freq] of df) {
            this.idf.set(token, Math.log((N - freq + 0.5) / (freq + 0.5) + 1));
        }
    }

    search(query: string, topK: number = 10): BM25Result[] {
        const queryTokens = tokenize(query);
        const scores: Map<string, number> = new Map();

        for (const doc of this.documents) {
            const docTokens = this.docTokens.get(doc.id) || [];
            const docLen = docTokens.length;
            let score = 0;

            const tf: Map<string, number> = new Map();
            for (const token of docTokens) {
                tf.set(token, (tf.get(token) || 0) + 1);
            }

            for (const qToken of queryTokens) {
                const tokenTf = tf.get(qToken) || 0;
                const tokenIdf = this.idf.get(qToken) || 0;

                if (tokenTf === 0) continue;

                const numerator = tokenTf * (this.k1 + 1);
                const denominator = tokenTf + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLen));
                score += tokenIdf * (numerator / denominator);
            }

            if (score > 0) {
                scores.set(doc.id, score);
            }
        }

        const results = Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, topK)
            .map(([id, score]) => ({
                id,
                score,
                document: this.documents.find(d => d.id === id)!,
            }))
            .filter(r => r.document);

        return results;
    }

    get size(): number {
        return this.documents.length;
    }
}

const bm25IndexCache = new Map<string, BM25Retriever>();

export function clearBM25Index(domain: string): void {
    bm25IndexCache.delete(domain);
}

export function getBM25Retriever(domain: string): BM25Retriever {
    if (!bm25IndexCache.has(domain)) {
        bm25IndexCache.set(domain, new BM25Retriever());
    }
    return bm25IndexCache.get(domain)!;
}

export async function initBM25Index(domain: string): Promise<BM25Retriever> {
    const retriever = getBM25Retriever(domain);

    try {
        const entries = await db.knowledgeEntry.findMany({
            where: { domain },
        });

        const documents: Document[] = entries.map(entry => ({
            id: entry.id,
            title: entry.title,
            content: [entry.summary, entry.etiology, entry.symptoms, entry.diagnosis, entry.treatment, entry.prevention, entry.content]
                .filter(Boolean)
                .join(' '),
            category: entry.category || undefined,
            source: entry.source,
        }));

        retriever.setDocuments(documents);
        console.log(`[BM25] 领域 ${domain} 索引构建完成，共 ${documents.length} 条文档`);
    } catch (e) {
        console.error(`[BM25] 领域 ${domain} 索引构建失败:`, e);
    }

    return retriever;
}