# 技术日志：LangChain 异步调用静默卡死问题排查与修复

**日期**：2026-05-20  
**标签**：`langchain` `async` `httpx` `FastAPI` `SSE` `Windows`

---

## 一、问题现象

- FastAPI SSE 端点 `POST /api/chat` 返回 `200 OK`，但前端持续显示“思考中”，没有任何消息推送。
- 后端控制台无错误日志，服务整体健康。
- 同步测试脚本（`test_llm.py`）可正常调用大模型并打印回复。

## 二、排查过程

### 尝试 1：直接同步 `invoke`
- 预期：LLM 返回结果后推送 SSE。
- 结果：卡死。同步调用阻塞了异步事件循环，生成器无法 `yield`。

### 尝试 2：改为 `ainvoke`（未显式配置异步 HTTP 客户端）
- 预期：使用异步调用避免阻塞事件循环。
- 结果：卡死。`ChatOpenAI` 内部使用默认 `httpx.AsyncClient`，在 Windows 下因 SSL 证书验证或代理导致 SSL 握手挂起，默认超时未能中断。

### 尝试 3：`asyncio.to_thread` 包装同步 `invoke`
- 预期：将同步调用放入线程池，避免阻塞事件循环。
- 结果：卡死。事件循环等待线程池结果，而 LLM 调用本身因 HTTP 客户端问题未返回。

### 尝试 4：`loop.run_in_executor` 包装同步 `invoke`
- 结果：同上，卡死。未解决底层 HTTP 客户端配置问题。

### 尝试 5：通过 `ChatOpenAI` 构造器传入 `http_async_client`
- 预期：显式设置异步客户端的 `verify=False` 和超时。
- 结果：卡死。构造器未正确应用该参数，异步客户端仍为默认值。

## 三、根因分析

`ChatOpenAI` 的同步客户端 `http_client` 和异步客户端 `http_async_client` 是**完全独立**的。只配置了 `http_client` 无法影响异步调用时使用的 `http_async_client`。默认的 `httpx.AsyncClient` 开启了 TLS 证书验证且未设置有效超时，在 Windows 环境下遇到证书不可信或代理时，SSL 握手会无限挂起，协程永远等待，不抛出任何异常。

## 四、最终解决方案

1. **改用 `langchain.chat_models.init_chat_model` 创建实例**，然后在实例上直接赋值替换客户端属性：
   ```python
   llm.http_client = httpx.Client(verify=False, timeout=...)
   llm.http_async_client = httpx.AsyncClient(verify=False, timeout=...)
   ```
   这确保了同步和异步客户端配置一致且真正生效。

2. **Free/Pro 流程采用 `astream` 流式输出**：将 `ainvoke` 改为 `async for chunk in llm.astream(...)`，逐 token 生成 SSE `content` 事件。

3. **所有 `yield` 点后调用 `await flush()`**：其中 `flush()` 定义为 `await asyncio.sleep(0)`，让出事件循环，强制 ASGI 服务器立即推送数据，实现真正的流式输出。

4. **前端 SSE 读取增加 60 秒超时保护**：使用 `Promise.race` 竞速，超时后自动终止流并提示用户。

## 五、关键教训

- LangChain 的 `ChatOpenAI` 同步/异步 HTTP 客户端独立管理，**异步调用必须同时配置 `http_async_client`**。
- 构造器传参可能被忽略，**直接赋值实例属性**是更可靠的配置方式。
- Windows 环境下异步 TLS 极易挂死，务必设置 `verify=False` 与合理超时。
- 问题诊断信号：**同步正常、异步卡死** → 立即检查异步 HTTP 客户端配置。