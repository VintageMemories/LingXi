import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// Allowed image MIME types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json()

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: '请提供图片数据' }, { status: 400 })
    }

    // Parse base64 data URL
    const matches = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
    if (!matches) {
      return NextResponse.json({ error: '图片格式不正确，请提供有效的 base64 编码图片' }, { status: 400 })
    }

    const mimeType = matches[1]
    const base64Data = matches[2]

    // Validate MIME type
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: '不支持的图片格式，请使用 JPG、PNG、GIF、WebP 或 SVG' },
        { status: 400 }
      )
    }

    // Validate size (base64 is ~33% larger than binary)
    const estimatedSize = Math.ceil(base64Data.length * 0.75)
    if (estimatedSize > MAX_SIZE) {
      return NextResponse.json(
        { error: '图片大小不能超过 2MB' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const ext = mimeType.split('/')[1].replace('jpeg', 'jpg')
    const filename = `avatar_${nanoid(10)}.${ext}`

    // Ensure avatars directory exists
    const avatarsDir = path.join(process.cwd(), 'public', 'avatars')
    await mkdir(avatarsDir, { recursive: true })

    // Write file
    const filePath = path.join(avatarsDir, filename)
    const buffer = Buffer.from(base64Data, 'base64')
    await writeFile(filePath, buffer)

    // Return the avatar URL
    const avatarUrl = `/avatars/${filename}`

    return NextResponse.json({ avatarUrl })
  } catch (error) {
    console.error('Avatar upload error:', error)
    return NextResponse.json(
      { error: '头像上传失败，请稍后重试' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { avatarUrl } = await req.json()

    if (!avatarUrl || typeof avatarUrl !== 'string') {
      return NextResponse.json({ error: '请提供头像URL' }, { status: 400 })
    }

    // Only allow deleting from /avatars/ directory
    if (!avatarUrl.startsWith('/avatars/')) {
      return NextResponse.json({ error: '无效的头像路径' }, { status: 400 })
    }

    const filename = path.basename(avatarUrl)
    const filePath = path.join(process.cwd(), 'public', 'avatars', filename)

    // Try to delete the file (ignore errors if file doesn't exist)
    try {
      const { unlink } = await import('fs/promises')
      await unlink(filePath)
    } catch {
      // File may not exist, that's ok
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Avatar delete error:', error)
    return NextResponse.json(
      { error: '删除头像失败' },
      { status: 500 }
    )
  }
}
