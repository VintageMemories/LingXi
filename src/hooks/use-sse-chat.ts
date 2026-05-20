'use client'

import { useCallback, useRef } from 'react'
import { useChatStore, type ChatMessage, type TokenUsage } from '@/stores/chat-store'

let messageIdCounter = 0
function generateId(): string {
  messageIdCounter += 1
  return `msg-${Date.now()}-${messageIdCounter}`
}

function estimateTokens(text: string): number {
  if (!text) return 0
  let tokens = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (
        (code >= 0x4e00 && code <= 0x9fff) ||
        (code >= 0x3400 && code <= 0x4dbf) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0x3000 && code <= 0x303f) ||
        (code >= 0xff00 && code <= 0xffef)
    ) {
      tokens += 1.5
    } else {
      tokens += 0.25
    }
  }
  return Math.ceil(tokens)
}

export function useSSEChat() {
  const abortControllerRef = useRef<AbortController | null>(null)

  const {
    currentDomain,
    sessionId,
    isStreaming,
    addMessage,
    updateMessage,
    appendToMessage,
    setSessionId,
    setIsStreaming,
    clearImages,
    removeLastAssistantMessage,
  } = useChatStore()

  const sendMessage = useCallback(
      async (content: string, images?: string[]) => {
        if (!content.trim() || isStreaming) return

        const sendTime = Date.now()

        const userMsg: ChatMessage = {
          id: generateId(),
          role: 'user',
          content: content.trim(),
          timestamp: Date.now(),
          images,
        }
        addMessage(userMsg)

        const assistantId = generateId()
        const assistantMsg: ChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
          statusBadges: [],
        }
        addMessage(assistantMsg)

        setIsStreaming(true)
        clearImages()

        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()

        let firstContentReceived = false

        try {
          const settings = useChatStore.getState().settings
          if (!settings.selectedModel) {
            updateMessage(assistantId, {
              content: '请先在设置中选择一个模型，然后重新发送消息。',
              isStreaming: false,
            })
            setIsStreaming(false)
            return
          }
          // 确保会话已创建（首次消息时由前端持久化）
          let currentSessionId = sessionId
          if (!currentSessionId) {
            const token = typeof window !== 'undefined' ? localStorage.getItem('lingxi_token') : ''
            const createRes = await fetch('/api/sessions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : '',
              },
              body: JSON.stringify({
                domain: currentDomain?.id || 'medical',
                title: content.trim().slice(0, 20) + (content.trim().length > 20 ? '...' : ''),
              }),
            })
            if (createRes.ok) {
              const createData = await createRes.json()
              currentSessionId = createData.session_id
              setSessionId(currentSessionId)
            }
          }

          console.log('[sendMessage] 准备 fetch /api/chat')
          const token = typeof window !== 'undefined' ? localStorage.getItem('lingxi_token') : null
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : '',
              'X-Model': settings.selectedModel,
              'X-API-Key': settings.apiKey,
              'X-API-Base-URL': settings.apiBaseUrl,
              'X-API-Provider': settings.apiProvider,
              'X-User-Plan': useChatStore.getState().user?.plan || 'free',
            },
            body: JSON.stringify({
              message: content.trim(),
              session_id: currentSessionId || undefined,
              domain: currentDomain?.id || 'medical',
              images: images || undefined,
            }),
            signal: abortControllerRef.current.signal,
          })
          console.log('[sendMessage] fetch 完成, status:', response.status)

          if (!response.ok) {
            updateMessage(assistantId, {
              content: '抱歉，请求处理失败，请稍后重试。',
              isStreaming: false,
            })
            setIsStreaming(false)
            useChatStore.getState().setIsConnected(false)
            return
          }

          useChatStore.getState().setIsConnected(true)

          const reader = response.body?.getReader()
          if (!reader) {
            updateMessage(assistantId, {
              content: '抱歉，无法建立连接。',
              isStreaming: false,
            })
            setIsStreaming(false)
            return
          }

          const decoder = new TextDecoder()
          let buffer = ''
          const READ_TIMEOUT = 60000 // 60 秒整体超时

          while (true) {
            const timeoutPromise = new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) =>
              setTimeout(() => reject(new Error('SSE_READ_TIMEOUT')), READ_TIMEOUT)
            )
            let result: ReadableStreamReadResult<Uint8Array>
            try {
              result = await Promise.race([reader.read(), timeoutPromise])
            } catch (e: any) {
              if (e?.message === 'SSE_READ_TIMEOUT') {
                console.warn('[SSE] 读取超时，强制结束')
                updateMessage(assistantId, {
                  content: '服务器响应超时，请稍后重试。',
                  isStreaming: false,
                })
                setIsStreaming(false)
                try { reader.cancel() } catch { /* ignore */ }
                return
              }
              throw e
            }
            const { done, value } = result
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed.startsWith('data: ')) continue

              const jsonStr = trimmed.slice(6)
              try {
                const event = JSON.parse(jsonStr)

                switch (event.type) {
                  case 'tool_start': {
                    const currentMsg = useChatStore.getState().messages.find((m) => m.id === assistantId)
                    const existingBadges = currentMsg?.statusBadges || []
                    updateMessage(assistantId, {
                      statusBadges: [
                        ...existingBadges,
                        {
                          type: 'tool_start' as const,
                          message: event.message || '正在分析...',
                          tools: event.tools,
                        },
                      ],
                    })
                    break
                  }

                  case 'retrieval_start': {
                    const currentMsg2 = useChatStore.getState().messages.find((m) => m.id === assistantId)
                    const existingBadges2 = currentMsg2?.statusBadges || []
                    updateMessage(assistantId, {
                      statusBadges: [
                        ...existingBadges2,
                        {
                          type: 'retrieval_start' as const,
                          message: event.message || '正在检索知识库...',
                        },
                      ],
                    })
                    break
                  }

                  case 'content':
                    appendToMessage(assistantId, event.text || '')
                    if (!firstContentReceived) {
                      firstContentReceived = true
                      const latency = Date.now() - sendTime
                      useChatStore.getState().setLastResponseLatency(latency)
                    }
                    break

                  case 'done': {
                    const finalMsg = useChatStore.getState().messages.find((m) => m.id === assistantId)
                    const assistantContent = finalMsg?.content || ''
                    const model = useChatStore.getState().settings.selectedModel || 'unknown'
                    const promptTokens = estimateTokens(content.trim())
                    const completionTokens = estimateTokens(assistantContent)
                    const tokenUsage: TokenUsage = {
                      promptTokens: promptTokens || 0,
                      completionTokens: completionTokens || 0,
                      totalTokens: (promptTokens || 0) + (completionTokens || 0),
                    }
                    const fromLLM = event.from_llm === true
                    updateMessage(assistantId, {
                      isStreaming: false,
                      intent: event.intent,
                      confidence: event.confidence,
                      sources: event.sources || [],
                      sourceHint: event.source_hint || null,
                      tokenUsage: fromLLM ? tokenUsage : undefined,
                    })
                    if (fromLLM) {
                      useChatStore.getState().addTokenUsage({
                        promptTokens,
                        completionTokens,
                        model,
                      })
                    }
                    setIsStreaming(false)
                    setTimeout(() => { useChatStore.getState().refreshSessions() }, 500)
                    break
                  }

                  case 'error':
                    updateMessage(assistantId, {
                      content: event.message || '抱歉，处理过程中出现错误。',
                      isStreaming: false,
                    })
                    setIsStreaming(false)
                    break
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        } catch (error: unknown) {
          if (error instanceof Error && error.name === 'AbortError') {
            return
          }
          updateMessage(assistantId, {
            content: '抱歉，网络连接出现问题，请稍后重试。',
            isStreaming: false,
          })
          setIsStreaming(false)
          useChatStore.getState().setIsConnected(false)
        }
      },
      [
        isStreaming,
        sessionId,
        currentDomain,
        addMessage,
        updateMessage,
        appendToMessage,
        setSessionId,
        setIsStreaming,
        clearImages,
      ]
  )

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
  }, [setIsStreaming])

  const regenerateMessage = useCallback(() => {
    if (isStreaming) return

    const messages = useChatStore.getState().messages
    let lastUserContent = ''
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserContent = messages[i].content
        break
      }
    }

    if (!lastUserContent) return

    removeLastAssistantMessage()
    sendMessage(lastUserContent)
  }, [isStreaming, removeLastAssistantMessage, sendMessage])

  return {
    sendMessage,
    stopStreaming,
    regenerateMessage,
    isStreaming,
  }
}