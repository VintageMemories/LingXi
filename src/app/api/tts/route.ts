import { NextRequest, NextResponse } from 'next/server'

// Split text into chunks of max 1000 characters, splitting at sentence boundaries
function splitTextIntoChunks(text: string, maxLength = 1000): string[] {
  if (text.length <= maxLength) return [text]

  const chunks: string[] = []
  // Split by Chinese/English sentence endings
  const sentences = text.match(/[^。！？.!?\n]+[。！？.!?\n]?/g) || [text]

  let currentChunk = ''
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence
    } else {
      if (currentChunk) chunks.push(currentChunk.trim())
      // If a single sentence exceeds maxLength, force split
      if (sentence.length > maxLength) {
        for (let i = 0; i < sentence.length; i += maxLength) {
          chunks.push(sentence.slice(i, i + maxLength).trim())
        }
        currentChunk = ''
      } else {
        currentChunk = sentence
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim())

  return chunks.filter(c => c.length > 0)
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'tongtong', speed = 1.0 } = await req.json()

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: '请提供要朗读的文本内容' },
        { status: 400 }
      )
    }

    // Limit to 2000 characters
    const truncatedText = text.length > 2000
      ? text.slice(0, 2000) + '...'
      : text

    // Import ZAI SDK (server-side only)
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    // Split text into chunks if needed (API limit: 1024 chars per request)
    const chunks = splitTextIntoChunks(truncatedText, 1000)

    if (chunks.length === 1) {
      // Single chunk - return audio directly
      const response = await zai.audio.tts.create({
        input: chunks[0],
        voice,
        speed: Math.min(Math.max(speed, 0.5), 2.0),
        response_format: 'mp3',
        stream: false,
      })

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(new Uint8Array(arrayBuffer))

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'no-cache',
        },
      })
    }

    // Multiple chunks - concatenate audio buffers
    const audioBuffers: Buffer[] = []
    for (const chunk of chunks) {
      const response = await zai.audio.tts.create({
        input: chunk,
        voice,
        speed: Math.min(Math.max(speed, 0.5), 2.0),
        response_format: 'mp3',
        stream: false,
      })
      const arrayBuffer = await response.arrayBuffer()
      audioBuffers.push(Buffer.from(new Uint8Array(arrayBuffer)))
    }

    const combinedBuffer = Buffer.concat(audioBuffers)

    return new NextResponse(combinedBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': combinedBuffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('TTS API Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '生成语音失败，请稍后重试',
      },
      { status: 500 }
    )
  }
}
