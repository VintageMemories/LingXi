"""
LLM Client module for Lingxi backend.
Supports multiple providers (DeepSeek, OpenAI, Qwen, Wenxin, custom).
Uses httpx for async HTTP calls.
"""
import json
from typing import AsyncGenerator, Optional, List, Dict

import httpx

from core.config import settings


PROVIDER_URLS = {
    "deepseek": "https://api.deepseek.com",
    "openai": "https://api.openai.com",
    "qwen": "https://dashscope.aliyuncs.com/compatible-mode",
    "wenxin": "https://aip.baidubce.com",
}


class LLMClient:
    """Unified LLM client supporting multiple providers."""

    def __init__(self):
        self.default_model = settings.default_model
        self.default_api_key = settings.default_api_key
        self.default_base_url = settings.default_api_base_url
        self.default_provider = settings.default_api_provider

    def _get_base_url(self, api_provider: Optional[str] = None, api_base_url: Optional[str] = None) -> str:
        if api_base_url:
            return api_base_url.rstrip("/")
        provider = api_provider or self.default_provider
        return PROVIDER_URLS.get(provider, self.default_base_url).rstrip("/")

    def _get_model(self, model: Optional[str] = None, api_provider: Optional[str] = None) -> str:
        if model:
            return model
        return self.default_model

    async def stream_chat(
            self,
            messages: List[Dict[str, str]],
            model: Optional[str] = None,
            api_key: Optional[str] = None,
            api_base_url: Optional[str] = None,
            api_provider: Optional[str] = None,
            temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        key = api_key or self.default_api_key
        if not key:
            raise ValueError("No API key configured.")

        base_url = self._get_base_url(api_provider, api_base_url)
        model_name = self._get_model(model, api_provider)

        url = f"{base_url}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    raise Exception(f"LLM API error ({response.status_code}): {error_text.decode()}")

                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue

    async def chat(
            self,
            messages: List[Dict[str, str]],
            model: Optional[str] = None,
            api_key: Optional[str] = None,
            api_base_url: Optional[str] = None,
            api_provider: Optional[str] = None,
            temperature: float = 0.7,
    ) -> str:
        key = api_key or self.default_api_key
        if not key:
            raise ValueError("No API key configured.")

        base_url = self._get_base_url(api_provider, api_base_url)
        model_name = self._get_model(model, api_provider)

        url = f"{base_url}/v1/chat/completions"
        headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": temperature,
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code != 200:
                raise Exception(f"LLM API error ({response.status_code}): {response.text}")
            data = response.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", "")

    async def classify_intent(self, query: str, intent_ids: List[str], **kwargs) -> str:
        messages = [
            {
                "role": "system",
                "content": f"你是一个意图分类器。请判断用户的问题属于以下哪个意图类别：{', '.join(intent_ids)}\n\n"
                           "规则：\n1. 只返回意图ID，不要返回其他内容\n2. 如果是问候语，分类为 greeting\n"
                           "3. 如果与当前领域无关，分类为 out_of_scope\n4. 默认分类为当前领域的通用查询",
            },
            {"role": "user", "content": query},
        ]
        try:
            result = await self.chat(messages, temperature=0, **kwargs)
            return result.strip()
        except Exception:
            return intent_ids[0] if intent_ids else "unknown"