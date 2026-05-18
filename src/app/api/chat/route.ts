/**
 * 聊天 API - SSE流式输出
 * 核心请求处理流程：安全过滤 → 意图分类 → 工具调用 → 混合检索 → LLM生成 → 流式输出
 */

import { NextRequest } from 'next/server';
import { getCurrentDomain, getDomainConfig } from '@/core/domain-config';
import { checkSafety, addDisclaimer } from '@/core/security/safety';
import { classifyIntent } from '@/core/intent/classifier';
import { classifyIntent as llmClassifyIntent, streamChat, buildRAGPrompt } from '@/core/llm/client';
import { search as hybridSearch, initAllIndices } from '@/core/retrieval/hybrid';
import { ToolExecutor } from '@/core/tools/executor';
import { addMessage, getHistory, updateLastAssistant, createSession, updateSessionTitle } from '@/core/memory/session';

// 初始化检索索引（延迟初始化）
let indicesInitialized = false;
async function ensureIndices() {
    if (!indicesInitialized) {
        try {
            await initAllIndices('medical');
            indicesInitialized = true;
        } catch (e) {
            console.error('[Chat API] 索引初始化失败:', e);
        }
    }
}

/**
 * SSE流式输出辅助函数
 */
function createSSEStream(handler: (controller: ReadableStreamDefaultController, encoder: TextEncoder) => Promise<void>) {
    const encoder = new TextEncoder();

    return new Response(
        new ReadableStream({
            async start(controller) {
                try {
                    await handler(controller, encoder);
                } catch (error) {
                    console.error('[SSE] Stream error:', error);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: '生成回答时出错' })}\n\n`));
                }
                controller.close();
            },
        }),
        {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        }
    );
}

/**
 * 逐字输出文本
 */
function streamText(
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder,
    text: string,
    chunkSize: number = 3
): Promise<void> {
    return new Promise((resolve) => {
        let i = 0;
        const interval = setInterval(() => {
            if (i < text.length) {
                const chunk = text.slice(i, i + chunkSize);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', text: chunk })}\n\n`));
                i += chunkSize;
            } else {
                clearInterval(interval);
                resolve();
            }
        }, 25);
    });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { message, session_id, domain, images } = body as {
            message: string;
            session_id?: string;
            domain?: string;
            images?: string[];
        };

        if (!message?.trim()) {
            return Response.json({ error: '消息不能为空' }, { status: 400 });
        }

        await ensureIndices();

        const domainConfig = domain ? getDomainConfig(domain) : getCurrentDomain();
        if (!domainConfig) {
            return Response.json({ error: '领域配置不存在' }, { status: 400 });
        }

        const isNewSession = !session_id;
        const sessionId = session_id || await createSession(domainConfig.domain.id);

        // 第一步：安全过滤
        const safetyResult = checkSafety(message, domainConfig);

        if (safetyResult.blocked) {
            return createSSEStream(async (controller, encoder) => {
                await streamText(controller, encoder, safetyResult.message);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', intent: 'blocked', session_id: sessionId })}\n\n`));
            });
        }

        // 第二步：意图分类
        const intentResult = await classifyIntent(
            message,
            domainConfig,
            async (query, history) => llmClassifyIntent(query, domainConfig, history)
        );

        // 第三步：紧急情况处理
        if (safetyResult.emergency || intentResult.intent === 'emergency') {
            const emergencyMsg = domainConfig.prompts.emergency || safetyResult.message;
            await addMessage(sessionId, 'user', message);
            await addMessage(sessionId, 'assistant', emergencyMsg);

            return createSSEStream(async (controller, encoder) => {
                await streamText(controller, encoder, emergencyMsg);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', intent: 'emergency', emergency: true, session_id: sessionId })}\n\n`));
            });
        }

        // 第四步：问候处理
        if (intentResult.intent === 'greeting') {
            const greetingMsg = `您好！我是${domainConfig.domain.name}，${domainConfig.domain.display_name}。请问有什么可以帮您的？`;
            await addMessage(sessionId, 'user', message);
            await addMessage(sessionId, 'assistant', greetingMsg);

            return createSSEStream(async (controller, encoder) => {
                await streamText(controller, encoder, greetingMsg);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', intent: 'greeting', session_id: sessionId })}\n\n`));
            });
        }

        // 第五步：范围外问题
        if (intentResult.intent === 'out_of_scope') {
            const oosMsg = domainConfig.prompts.out_of_scope;
            await addMessage(sessionId, 'user', message);
            await addMessage(sessionId, 'assistant', oosMsg);

            return createSSEStream(async (controller, encoder) => {
                await streamText(controller, encoder, oosMsg);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', intent: 'out_of_scope', session_id: sessionId })}\n\n`));
            });
        }

        // 第六步：工具调用
        let toolResults: string[] = [];
        if (intentResult.tools.length > 0) {
            try {
                const toolExecutor = new ToolExecutor(domainConfig);
                for (const toolName of intentResult.tools) {
                    const result = await toolExecutor.execute(toolName, message);
                    if (result.success) {
                        toolResults.push(result.data);
                    }
                }
            } catch (e) {
                console.error('[Chat API] 工具调用失败:', e);
            }
        }

        // 第七步：混合检索
        let ragContext = '';
        let sources: Array<{ title: string; source: string }> = [];
        let isRagUseful = false;

        if (intentResult.needsRag) {
            try {
                const retrievalResults = await hybridSearch(message, domainConfig);
                if (retrievalResults.length > 0) {
                    ragContext = retrievalResults.map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`).join('\n\n');
                    sources = retrievalResults.map(r => ({ title: r.title, source: r.source || 'unknown' }));
                    isRagUseful = retrievalResults.some(r => r.score > 0.01);
                }
            } catch (e) {
                console.error('[Chat API] 检索失败:', e);
            }
        }

        // 第八步：构建消息
        await addMessage(sessionId, 'user', message);

        const systemPrompt = domainConfig.prompts.system;
        const history = await getHistory(sessionId);

        const messages: Array<{ role: string; content: string }> = [
            { role: 'system', content: systemPrompt },
        ];

        // 最近10条历史
        const recentHistory = history.slice(-10);
        for (const msg of recentHistory) {
            if (msg.role !== 'system') {
                messages.push({ role: msg.role, content: msg.content });
            }
        }

        // 工具结果
        if (toolResults.length > 0) {
            messages.push({ role: 'assistant', content: `工具分析结果：\n${toolResults.join('\n')}` });
        }

        // RAG上下文
        if (ragContext) {
            const ragPrompt = domainConfig.prompts.rag.replace('{context}', ragContext).replace('{query}', message);
            messages.push({ role: 'user', content: ragPrompt });
        } else {
            messages.push({ role: 'user', content: message });
        }

        // 第九步：流式输出
        return createSSEStream(async (controller, encoder) => {
            let fullAnswer = '';

            // 发送工具/检索状态
            if (intentResult.tools.length > 0) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'tool_start',
                    tools: intentResult.tools,
                    message: '正在分析您的问题...',
                })}\n\n`));
            }

            if (intentResult.needsRag && ragContext) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'retrieval_start',
                    message: '正在检索知识库...',
                })}\n\n`));
            }

            // 流式LLM生成
            for await (const chunk of streamChat(messages)) {
                fullAnswer += chunk;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', text: chunk })}\n\n`));
            }

            // 只有 LLM 真正返回了 AI 回复时才添加免责声明
            // fallback 提示（如"请配置 API Key"）不加免责声明
            const isFallback = fullAnswer.includes('您还没有配置 AI 模型 API Key') || fullAnswer.includes('关于您的问题') || fullAnswer.includes('感谢您的提问');
            if (!isFallback) {
                const finalAnswer = addDisclaimer(fullAnswer, domainConfig, isRagUseful);
                if (finalAnswer !== fullAnswer) {
                    const disclaimer = finalAnswer.substring(fullAnswer.length);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', text: disclaimer })}\n\n`));
                    fullAnswer = finalAnswer;
                }
            }

            // 保存 AI 回复到数据库
            await addMessage(sessionId, 'assistant', fullAnswer);

            // 自动生成会话标题（新会话第一次对话时）
            if (isNewSession) {
                const titleText = message.trim().slice(0, 20) + (message.trim().length > 20 ? '...' : '');
                await updateSessionTitle(sessionId, titleText);
            }

            // 完成信号
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'done',
                intent: intentResult.intent,
                confidence: intentResult.confidence,
                sources: isRagUseful ? sources : [],
                source_hint: isRagUseful ? null : '以上为 AI 通用知识，仅供参考',
                session_id: sessionId,
            })}\n\n`));
        });

    } catch (error) {
        console.error('[Chat API] 请求处理失败:', error);
        return Response.json({ error: '服务器内部错误' }, { status: 500 });
    }
}