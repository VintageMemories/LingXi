import { NextRequest, NextResponse } from 'next/server';

const PROVIDER_MODELS: Record<string, { id: string; name: string }[]> = {
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat' },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'o1-mini', name: 'O1 Mini' },
  ],
  qwen: [
    { id: 'qwen-max', name: 'Qwen Max' },
    { id: 'qwen-plus', name: 'Qwen Plus' },
    { id: 'qwen-turbo', name: 'Qwen Turbo' },
  ],
  wenxin: [
    { id: 'ernie-4.0', name: 'ERNIE 4.0' },
    { id: 'ernie-3.5-turbo', name: 'ERNIE 3.5 Turbo' },
  ],
  zhipu: [
    { id: 'glm-4-plus', name: 'GLM-4 Plus' },
    { id: 'glm-4-flash', name: 'GLM-4 Flash' },
    { id: 'glm-4-air', name: 'GLM-4 Air' },
  ],
  copilot: [],
  custom: [],
};

const PROVIDER_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode',
  wenxin: 'https://aip.baidubce.com',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  copilot: 'https://api.githubcopilot.com',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider') || 'deepseek';
  const apiKey = searchParams.get('api_key') || '';
  const baseUrl = searchParams.get('base_url') || PROVIDER_BASE_URLS[provider] || '';

  // Try to fetch from provider API
  if (baseUrl && apiKey) {
    try {
      const modelsUrl = `${baseUrl.replace(/\/+$/, '')}/v1/models`;
      const res = await fetch(modelsUrl, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        const modelList = data.data || data.models || [];
        if (modelList.length > 0) {
          const models = modelList.map((m: { id: string; name?: string }) => ({
            id: m.id,
            name: m.name || m.id,
          }));
          return NextResponse.json({ provider, models, source: 'remote', total: models.length });
        }
      }
    } catch (e) {
      console.error('[Models API] Fetch failed:', e instanceof Error ? e.message : e)
    }
  }

  // Return builtin models as fallback
  const builtinModels = PROVIDER_MODELS[provider] || [];
  return NextResponse.json({
    provider,
    models: builtinModels,
    source: builtinModels.length > 0 ? 'builtin' : 'none',
  });
}