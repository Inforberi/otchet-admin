import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { existsSync } from "fs"

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads"
const MAX_FILE_SIZE = Number.parseInt(process.env.MAX_UPLOAD_SIZE || "10485760") // 10MB default
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]

// Получаем абсолютный путь к директории загрузок
function getUploadDir(): string {
  if (path.isAbsolute(UPLOAD_DIR)) {
    return UPLOAD_DIR
  }
  return path.join(process.cwd(), UPLOAD_DIR)
}

// Генерация безопасного имени файла
function generateSafeFilename(originalName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 9)
  const ext = path.extname(originalName).toLowerCase()
  const baseName = path.basename(originalName, ext).replace(/[^a-z0-9]/gi, "_")
  return `${timestamp}_${random}_${baseName}${ext}`
}

// POST /api/uploads - загрузка файла
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const reportId = formData.get("reportId") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Валидация типа
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`,
        },
        { status: 400 },
      )
    }

    // Валидация размера
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 },
      )
    }

    // Получаем абсолютный путь к директории загрузок
    const uploadDir = getUploadDir()
    
    // Создаем директорию если не существует
    try {
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true })
        console.log(`Created upload directory: ${uploadDir}`)
      }
    } catch (dirError) {
      console.error(`Error creating upload directory ${uploadDir}:`, dirError)
      return NextResponse.json(
        { error: `Failed to create upload directory: ${dirError}` },
        { status: 500 }
      )
    }

    // Генерируем безопасное имя и путь
    const safeFilename = generateSafeFilename(file.name)
    const relativePath = safeFilename // Только имя файла, без "uploads/"
    const absolutePath = path.join(uploadDir, safeFilename)

    console.log(`Uploading file to: ${absolutePath} (uploadDir: ${uploadDir})`)

    // Сохраняем файл
    try {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(absolutePath, buffer)
      console.log(`File saved successfully: ${absolutePath}`)
    } catch (writeError) {
      console.error(`Error writing file to ${absolutePath}:`, writeError)
      return NextResponse.json(
        { error: `Failed to save file: ${writeError}` },
        { status: 500 }
      )
    }

    // Сохраняем метаданные в БД
    const upload = await prisma.upload.create({
      data: {
        reportId: reportId || null,
        filename: file.name,
        path: relativePath,
        mimeType: file.type,
        size: file.size,
      },
    })

    return NextResponse.json(
      {
        upload,
        url: `/api/static/uploads/${relativePath}`, // URL для доступа к файлу
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error uploading file:", error)
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
  }
}

// GET /api/uploads - список загрузок (опционально с фильтром по reportId)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const reportId = searchParams.get("reportId")

    const uploads = await prisma.upload.findMany({
      where: reportId ? { reportId } : undefined,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ uploads }, { status: 200 })
  } catch (error) {
    console.error("Error fetching uploads:", error)
    return NextResponse.json({ error: "Failed to fetch uploads" }, { status: 500 })
  }
}
