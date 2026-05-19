import { NextRequest, NextResponse } from 'next/server';

const PROVIDER_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode',
  wenxin: 'https://aip.baidubce.com',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider') || 'deepseek';
  const apiKey = searchParams.get('api_key') || '';
  const baseUrl = searchParams.get('base_url') || PROVIDER_BASE_URLS[provider] || '';

  if (!baseUrl || !apiKey) {
    return NextResponse.json({ provider, models: [], source: 'none' });
  }

  try {
    const modelsUrl = `${baseUrl.replace(/\/+$/, '')}/v1/models`;
    const res = await fetch(modelsUrl, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      const modelList = data.data || data.models || [];
      const models = modelList.map((m: { id: string; name?: string }) => ({
        id: m.id,
        name: m.name || m.id,
      }));
      return NextResponse.json({ provider, models, source: 'remote', total: models.length });
    }
  } catch (e) {
    console.error('[Models API] Fetch failed:', e instanceof Error ? e.message : e)
  }

  return NextResponse.json({ provider, models: [], source: 'failed' });
}