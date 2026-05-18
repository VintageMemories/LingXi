/**
 * 向量检索引擎
 */

import { db } from '@/lib/db';

interface Document {
    id: string;
    title: string;
    content: string;
    category?: string;
    source?: string;
}

interface VectorResult {
    id: string;
    score: number;
    document: Document;
}

interface VectorEntry {
    id: string;
    embedding: number[];
    document: Document;
}

function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dot / denominator;
}

function textToVector(text: string, vocabulary: Map<string, number>): number[] {
    const vector = new Array(vocabulary.size).fill(0);
    const tokens = text.toLowerCase().split(/[\s,，。.！!？?；;：:、]+/).filter(Boolean);

    for (const token of tokens) {
        const idx = vocabulary.get(token);
        if (idx !== undefined) {
            vector[idx] += 1;
        }
    }

    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
        for (let i = 0; i < vector.length; i++) {
            vector[i] /= norm;
        }
    }

    return vector;
}

export class VectorRetriever {
    private entries: VectorEntry[] = [];
    private vocabulary: Map<string, number> = new Map();
    private documents: Document[] = [];

    setDocuments(docs: Document[]): void {
        this.documents = docs;
        this._buildVocabulary();
        this._buildVectors();
    }

    private _buildVocabulary(): void {
        this.vocabulary.clear();
        let idx = 0;

        for (const doc of this.documents) {
            const text = `${doc.title} ${doc.content}`;
            const tokens = text.toLowerCase().split(/[\s,，。.！!？?；;：:、]+/).filter(Boolean);

            for (const token of tokens) {
                if (!this.vocabulary.has(token)) {
                    this.vocabulary.set(token, idx++);
                }
            }
        }
    }

    private _buildVectors(): void {
        this.entries = [];

        for (const doc of this.documents) {
            const text = `${doc.title} ${doc.content}`;
            const embedding = textToVector(text, this.vocabulary);

            this.entries.push({
                id: doc.id,
                embedding,
                document: doc,
            });
        }
    }

    search(query: string, topK: number = 10): VectorResult[] {
        const queryVector = textToVector(query, this.vocabulary);

        const scored = this.entries.map(entry => ({
            id: entry.id,
            score: cosineSimilarity(queryVector, entry.embedding),
            document: entry.document,
        }));

        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .filter(r => r.score > 0);
    }

    get size(): number {
        return this.entries.length;
    }
}

const vectorIndexCache = new Map<string, VectorRetriever>();

export function clearVectorIndex(domain: string): void {
    vectorIndexCache.delete(domain);
}

export function getVectorRetriever(domain: string): VectorRetriever {
    if (!vectorIndexCache.has(domain)) {
        vectorIndexCache.set(domain, new VectorRetriever());
    }
    return vectorIndexCache.get(domain)!;
}

export async function initVectorIndex(domain: string): Promise<VectorRetriever> {
    const retriever = getVectorRetriever(domain);

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
        console.log(`[Vector] 领域 ${domain} 索引构建完成，共 ${documents.length} 条文档`);
    } catch (e) {
        console.error(`[Vector] 领域 ${domain} 索引构建失败:`, e);
    }

    return retriever;
}