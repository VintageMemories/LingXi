'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useChatStore } from '@/stores/chat-store'

export interface PresenceUser {
  userId: string
  userName: string
}

export function usePresence() {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([])
  const [typingUsers, setTypingUsers] = useState<PresenceUser[]>([])
  const typingTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const sessionId = useChatStore((s) => s.sessionId)
  const user = useChatStore((s) => s.user)

  const getCurrentUser = useCallback(() => {
    if (user) {
      return { userId: user.id, userName: user.name }
    }
    if (typeof window !== 'undefined') {
      let anonId = localStorage.getItem('lingxi_anon_id')
      let anonName = localStorage.getItem('lingxi_anon_name')
      if (!anonId) {
        anonId = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        anonName = `访客${Math.floor(Math.random() * 9000 + 1000)}`
        localStorage.setItem('lingxi_anon_id', anonId)
        localStorage.setItem('lingxi_anon_name', anonName)
      }
      return { userId: anonId, userName: anonName || '访客' }
    }
    return { userId: 'unknown', userName: '未知用户' }
  }, [user])

  useEffect(() => {
    const socket = io('/', {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      console.log('[Presence] Connected to presence service')
      const currentSessionId = useChatStore.getState().sessionId
      if (currentSessionId) {
        const { userId, userName } = getCurrentUser()
        socket.emit('join-session', { sessionId: currentSessionId, userId, userName })
      }
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
      console.log('[Presence] Disconnected from presence service')
    })

    socket.on('session-users', (data: { sessionId: string; users: Array<{ userId: string; userName: string }> }) => {
      const currentUser = getCurrentUser()
      const otherUsers = data.users.filter(u => u.userId !== currentUser.userId)
      setActiveUsers(otherUsers)
    })

    socket.on('user-joined', (data: { sessionId: string; userId: string; userName: string }) => {
      const currentUser = getCurrentUser()
      if (data.userId !== currentUser.userId) {
        setActiveUsers(prev => {
          if (prev.find(u => u.userId === data.userId)) return prev
          return [...prev, { userId: data.userId, userName: data.userName }]
        })
      }
    })

    socket.on('user-left', (data: { sessionId: string; userId: string }) => {
      setActiveUsers(prev => prev.filter(u => u.userId !== data.userId))
      setTypingUsers(prev => prev.filter(u => u.userId !== data.userId))
      const timeout = typingTimeoutRef.current.get(data.userId)
      if (timeout) {
        clearTimeout(timeout)
        typingTimeoutRef.current.delete(data.userId)
      }
    })

    socket.on('user-typing', (data: { sessionId: string; userId: string; userName: string }) => {
      setTypingUsers(prev => {
        if (prev.find(u => u.userId === data.userId)) return prev
        return [...prev, { userId: data.userId, userName: data.userName }]
      })
      const existingTimeout = typingTimeoutRef.current.get(data.userId)
      if (existingTimeout) clearTimeout(existingTimeout)
      const timeout = setTimeout(() => {
        setTypingUsers(prev => prev.filter(u => u.userId !== data.userId))
        typingTimeoutRef.current.delete(data.userId)
      }, 3000)
      typingTimeoutRef.current.set(data.userId, timeout)
    })

    socket.on('user-stop-typing', (data: { sessionId: string; userId: string }) => {
      setTypingUsers(prev => prev.filter(u => u.userId !== data.userId))
      const timeout = typingTimeoutRef.current.get(data.userId)
      if (timeout) {
        clearTimeout(timeout)
        typingTimeoutRef.current.delete(data.userId)
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [getCurrentUser])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !socket.connected) return
    const { userId, userName } = getCurrentUser()
    if (sessionId) {
      socket.emit('join-session', { sessionId, userId, userName })
    }
    return () => {
      if (sessionId) {
        socket.emit('leave-session', { sessionId, userId })
      }
      setActiveUsers([])
      setTypingUsers([])
    }
  }, [sessionId, getCurrentUser])

  const emitTyping = useCallback(() => {
    const socket = socketRef.current
    const currentSessionId = useChatStore.getState().sessionId
    if (!socket || !socket.connected || !currentSessionId) return
    const { userId, userName } = getCurrentUser()
    socket.emit('typing', { sessionId: currentSessionId, userId, userName })
  }, [getCurrentUser])

  const emitStopTyping = useCallback(() => {
    const socket = socketRef.current
    const currentSessionId = useChatStore.getState().sessionId
    if (!socket || !socket.connected || !currentSessionId) return
    const { userId } = getCurrentUser()
    socket.emit('stop-typing', { sessionId: currentSessionId, userId })
  }, [getCurrentUser])

  const emitNewMessage = useCallback(() => {
    const socket = socketRef.current
    const currentSessionId = useChatStore.getState().sessionId
    if (!socket || !socket.connected || !currentSessionId) return
    const { userId } = getCurrentUser()
    socket.emit('new-message', { sessionId: currentSessionId, userId })
  }, [getCurrentUser])

  return {
    isConnected,
    activeUsers,
    typingUsers,
    emitTyping,
    emitStopTyping,
    emitNewMessage,
  }
}