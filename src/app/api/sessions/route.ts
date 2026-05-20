/**
 * 会话管理 API
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const { domain, title, session_id } = await request.json();
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.replace('Bearer ', '');
        let userId: string | undefined = undefined;
        if (token) {
            try {
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                userId = payload.userId;
            } catch {}
        }
        const data: Record<string, unknown> = { domain: domain || 'medical', title: title || null };
        if (session_id) data.id = session_id;
        if (userId) data.userId = userId;
        const session = await db.session.create({ data });
        const sessionId = session.id;

        return Response.json({
            session_id: sessionId,
            created_at: new Date().toISOString(),
        });
    } catch (error) {
        return Response.json({ error: '创建会话失败' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization') || ''
        const token = authHeader.replace('Bearer ', '')
        let userId: string | undefined = undefined
        if (token) {
            try {
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
                userId = payload.userId
            } catch {}
        }

        const sessions = await db.session.findMany({
            where: userId
                ? { OR: [ { userId }, { userId: null } ] }
                : undefined,
            orderBy: { updatedAt: 'desc' },
            take: 50,
            include: {
                _count: {
                    select: { messages: true },
                },
            },
        });

        // Fetch tags via raw SQL as fallback for cached PrismaClient
        let tagsMap: Record<string, string[]> = {};
        try {
            const tagsRows = await db.$queryRaw`SELECT id, tags FROM Session` as Array<{ id: string; tags: string | null }>;
            for (const row of tagsRows) {
                if (row.tags) {
                    try { tagsMap[row.id] = JSON.parse(row.tags); } catch { /* ignore */ }
                }
            }
        } catch {
            // Raw SQL fallback failed
        }

        const result = sessions.map((s) => {
            let tags: string[] | undefined;
            if ('tags' in s && (s as Record<string, unknown>).tags) {
                try { tags = JSON.parse((s as Record<string, unknown>).tags as string); } catch { /* ignore */ }
            } else if (tagsMap[s.id]) {
                tags = tagsMap[s.id];
            }

            return {
                id: s.id,
                domain: s.domain,
                title: s.title,
                tags,
                createdAt: s.createdAt.toISOString(),
                updatedAt: s.updatedAt.toISOString(),
                messageCount: s._count.messages,
            };
        });

        return Response.json({ sessions: result });
    } catch (error) {
        console.error('[Sessions API] GET error:', error);
        return Response.json({ error: '获取会话失败' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { session_id } = await request.json();
        if (!session_id) {
            return Response.json({ error: '缺少session_id' }, { status: 400 });
        }

        await db.message.deleteMany({ where: { sessionId: session_id } });
        await db.session.delete({ where: { id: session_id } });
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: '删除会话失败' }, { status: 500 });
    }
}