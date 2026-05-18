/**
 * 会话记忆管理
 */

import { db } from '@/lib/db';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

const sessionCache = new Map<string, Message[]>();
const MAX_MESSAGES = 20;

export async function addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string
): Promise<void> {
    if (!sessionCache.has(sessionId)) {
        sessionCache.set(sessionId, []);
    }
    const messages = sessionCache.get(sessionId)!;
    messages.push({ role, content, timestamp: Date.now() });

    if (messages.length > MAX_MESSAGES) {
        sessionCache.set(sessionId, messages.slice(-MAX_MESSAGES));
    }

    try {
        const existingSession = await db.session.findUnique({ where: { id: sessionId } });
        if (!existingSession) {
            await db.session.create({
                data: { id: sessionId, domain: 'medical' },
            });
        }

        await db.message.create({
            data: {
                sessionId,
                role,
                content,
            },
        });
    } catch (e) {
        console.error('[SessionManager] 写入数据库失败:', e);
    }
}

export async function getHistory(sessionId: string): Promise<Message[]> {
    if (sessionCache.has(sessionId)) {
        return sessionCache.get(sessionId)!;
    }

    try {
        const messages = await db.message.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'asc' },
            take: MAX_MESSAGES,
        });

        const result = messages.map(m => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
            timestamp: new Date(m.createdAt).getTime(),
        }));

        sessionCache.set(sessionId, result);
        return result;
    } catch (e) {
        console.error('[SessionManager] 读取数据库失败:', e);
        return [];
    }
}

export async function buildHistoryContext(sessionId: string): Promise<string> {
    const history = await getHistory(sessionId);
    if (history.length === 0) return '';

    let context = '【对话历史】\n';
    for (const msg of history) {
        const roleText = msg.role === 'user' ? '用户' : '助手';
        context += `${roleText}：${msg.content}\n`;
    }

    return context;
}

export async function updateLastAssistant(sessionId: string, content: string): Promise<void> {
    const messages = sessionCache.get(sessionId);
    if (messages) {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
                messages[i].content = content;
                break;
            }
        }
    }

    try {
        const lastMsg = await db.message.findFirst({
            where: { sessionId, role: 'assistant' },
            orderBy: { createdAt: 'desc' },
        });
        if (lastMsg) {
            await db.message.update({
                where: { id: lastMsg.id },
                data: { content },
            });
        }
    } catch (e) {
        console.error('[SessionManager] 更新数据库失败:', e);
    }
}

export async function clearSession(sessionId: string): Promise<void> {
    sessionCache.delete(sessionId);
    try {
        await db.message.deleteMany({ where: { sessionId } });
        await db.session.delete({ where: { id: sessionId } });
    } catch (e) {
        console.error('[SessionManager] 清除会话失败:', e);
    }
}

export async function createSession(domain: string = 'medical', title?: string): Promise<string> {
    const session = await db.session.create({
        data: { domain, title: title || null },
    });
    sessionCache.set(session.id, []);
    return session.id;
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
    try {
        await db.session.update({
            where: { id: sessionId },
            data: { title },
        });
    } catch (e) {
        console.error('[SessionManager] 更新会话标题失败:', e);
    }
}

export async function getUserSessions(userId?: string) {
    try {
        return await db.session.findMany({
            where: userId ? { userId } : undefined,
            orderBy: { updatedAt: 'desc' },
            take: 50,
        });
    } catch (e) {
        console.error('[SessionManager] 获取会话列表失败:', e);
        return [];
    }
}