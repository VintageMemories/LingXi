"""
通用网络搜索工具 - 基于免费的 HTTP 请求搜索引擎
"""
import json
import urllib.request
import urllib.parse
import re
from typing import Dict, Any, List

from ..base import BaseTool


class WebSearchTool(BaseTool):

    @property
    def name(self) -> str:
        return "web_search"

    @property
    def description(self) -> str:
        return (
            "当其他所有工具都无法回答用户问题时，使用此工具搜索互联网获取公开信息。\n"
            "返回结果包含：标题、URL、内容摘要。\n"
            "适用场景：\n"
            "- 专业工具和知识库均无法覆盖的实时信息、新闻、常识问题\n"
            "- 需要查询最新的公开数据、政策、研究成果时\n"
            "- 当Agent多次尝试其他工具后仍无满意结果时的最终兜底方案"
        )

    @property
    def domain(self) -> str:
        return "builtin"

    def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        query = params.get("query", "")
        if not query:
            return {"success": False, "data": "请提供搜索关键词"}

        # 1. 必应（HTML结构相对稳定）
        result = self._search_bing(query)
        if result:
            return {"success": True, "data": result}

        # 2. 百度（国内最常用）
        result = self._search_baidu(query)
        if result:
            return {"success": True, "data": result}

        # 3. DuckDuckGo 搜索
        result = self._search_duckduckgo_api(query)
        if result:
            return {"success": True, "data": result}

        # 4. 彻底失败
        print("[WebSearch] 所有引擎均无有效结果")
        return {
            "success": True,
            "data": json.dumps({
                "status": "network_error",
                "message": "所有搜索接口均不可达或返回空结果，请稍后重试。",
                "action": "return_to_agent"
            }, ensure_ascii=False)
        }

    @staticmethod
    def _search_bing(query: str) -> str:
        """必应搜索"""
        try:
            search_url = f"https://cn.bing.com/search?q={urllib.request.quote(query)}&count=10"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept-Language": "zh-CN,zh;q=0.9",
            }
            req = urllib.request.Request(search_url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                html = resp.read().decode("utf-8", errors="replace")

            results = []
            # 用更宽泛的正则匹配必应的结果块
            pattern = r'<li class="b_algo"[^>]*>.*?<h2[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>.*?<p[^>]*>(.*?)</p>'
            matches = re.findall(pattern, html, re.DOTALL)
            for m in matches[:5]:
                url = m[0].replace("&amp;", "&")
                title = re.sub(r'<[^>]+>', '', m[1]).strip()
                snippet = re.sub(r'<[^>]+>', '', m[2]).strip()
                if title:
                    results.append({"title": title, "url": url, "snippet": snippet})

            print(f"[WebSearch] 必应匹配到 {len(results)} 条结果")
            if not results:
                return ""
            return WebSearchTool._format_results(results, "必应")
        except Exception as e:
            print(f"[WebSearch] 必应搜索失败: {e}")
            return ""

    @staticmethod
    def _search_baidu(query: str) -> str:
        """百度搜索"""
        try:
            search_url = f"https://www.baidu.com/s?wd={urllib.request.quote(query)}&rn=10"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "zh-CN,zh;q=0.9",
            }
            req = urllib.request.Request(search_url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                html = resp.read().decode("utf-8", errors="replace")

            results = []
            # 百度标题通常在 <h3> 标签内，链接在 href 属性中
            pattern = r'<h3[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>'
            h3_matches = re.findall(pattern, html, re.DOTALL)
            # 同时找摘要
            snippet_pattern = r'<span[^>]*class="content-right_[^"]*"[^>]*>(.*?)</span>'
            snippets = re.findall(snippet_pattern, html, re.DOTALL)

            for i, (url, title) in enumerate(h3_matches[:5]):
                url = url.replace("&amp;", "&")
                title = re.sub(r'<[^>]+>', '', title).strip()
                snippet = re.sub(r'<[^>]+>', '', snippets[i] if i < len(snippets) else "").strip()
                if title:
                    results.append({"title": title, "url": url, "snippet": snippet})

            print(f"[WebSearch] 百度匹配到 {len(results)} 条结果")
            if not results:
                return ""
            return WebSearchTool._format_results(results, "百度")
        except Exception as e:
            print(f"[WebSearch] 百度搜索失败: {e}")
            return ""

    @staticmethod
    def _search_duckduckgo_api(query: str) -> str:
        """DuckDuckGo 搜索"""
        try:
            from duckduckgo_search import DDGS
            with DDGS() as ddgs:
                raw_results = list(ddgs.text(query, max_results=5))
            if not raw_results:
                return ""
            formatted = []
            for r in raw_results:
                formatted.append({
                    "title": r.get("title", "").strip(),
                    "url": r.get("href", "").strip(),
                    "snippet": r.get("body", "").strip()
                })
            return WebSearchTool._format_results(formatted, "DuckDuckGo")
        except ImportError:
            print("[WebSearch] duckduckgo-search 库未安装，跳过")
            return ""
        except Exception as e:
            print(f"[WebSearch] DuckDuckGo 搜索失败: {e}")
            return ""

    @staticmethod
    def _format_results(results: List[Dict[str, str]], source: str) -> str:
        if not results:
            return ""
        lines = [f"以下是从网络上搜索到的相关信息（来源：{source}）：\n"]
        for i, r in enumerate(results[:5], 1):
            title = r.get("title", "无标题").strip()
            snippet = r.get("snippet", "").strip()
            url = r.get("url", "").strip()
            lines.append(f"{i}. **{title}**")
            if snippet:
                lines.append(f"   {snippet[:300]}")
            if url:
                lines.append(f"   链接: {url}")
            lines.append("")
        return "\n".join(lines)