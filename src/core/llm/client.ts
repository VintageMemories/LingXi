/**
 * LLM客户端 - 占位模块
 * 聊天请求由 src/app/api/chat/route.ts 处理，
 * 未配置 API Key 时返回友好提示。
 */

export async function* streamChat(
    messages: Array<{ role: string; content: string }>,
    _options?: { temperature?: number; thinking?: boolean }
): AsyncGenerator<string, void, unknown> {
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || ''
    yield `关于您的问题「${lastUserMsg.slice(0, 30)}${lastUserMsg.length > 30 ? '...' : ''}」，我需要 AI 模型来生成更准确的回答。\n\n⚠️ 请前往**设置 → 模型**页面配置 API Key（支持 DeepSeek、OpenAI、通义千问等）。\n\n配置完成后我将能为您提供专业的领域知识解答。`
}

export async function chat(
    messages: Array<{ role: string; content: string }>,
    options?: { temperature?: number; thinking?: boolean }
): Promise<string> {
    let result = ''
    for await (const chunk of streamChat(messages, options)) {
        result += chunk
    }
    return result
}

export async function classifyIntent(
    query: string,
    domainConfig: { domain: { id: string }; intents: Array<{ id: string; keywords: string[] }> },
    _history?: string
): Promise<string> {
    const queryLower = query.toLowerCase()
    for (const intent of domainConfig.intents) {
        if (intent.keywords && intent.keywords.some(kw => queryLower.includes(kw.toLowerCase()))) {
            return intent.id
        }
    }
    return domainConfig.intents.length > 0 ? domainConfig.intents[domainConfig.intents.length - 1].id : 'unknown'
}

export async function understandImage(_imageBase64: string, _prompt: string = '请描述这张图片'): Promise<string> {
    return '图片分析功能暂未实现'
}

export function buildRAGPrompt(
    query: string,
    context: string,
    systemPrompt: string,
    ragTemplate: string
): Array<{ role: string; content: string }> {
    const userContent = ragTemplate.replace('{context}', context).replace('{query}', query)
    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
    ]
}