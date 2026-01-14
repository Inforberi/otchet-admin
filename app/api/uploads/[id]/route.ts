import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { unlink } from "fs/promises"
import path from "path"
import { existsSync } from "fs"

// DELETE /api/uploads/[id] - удалить загруженный файл
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const upload = await prisma.upload.findUnique({
      where: { id },
    })

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 })
    }

    // Удаляем файл с диска
    const filePath = path.join(process.cwd(), upload.path)
    if (existsSync(filePath)) {
      await unlink(filePath)
    }

    // Удаляем запись из БД
    await prisma.upload.delete({
      where: { id },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error deleting upload:", error)
    return NextResponse.json({ error: "Failed to delete upload" }, { status: 500 })
  }
}
