import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { CreateBlockInput } from "@/lib/db-types"

// GET /api/reports/[id]/blocks - получить все блоки отчета
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const blocks = await prisma.reportBlock.findMany({
      where: { reportId: id },
      orderBy: { position: "asc" },
    })

    return NextResponse.json({ blocks }, { status: 200 })
  } catch (error) {
    console.error("Error fetching blocks:", error)
    return NextResponse.json({ error: "Failed to fetch blocks" }, { status: 500 })
  }
}

// POST /api/reports/[id]/blocks - создать новый блок
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: reportId } = await params
    const body: Omit<CreateBlockInput, "reportId"> = await request.json()

    if (!body.type || !body.data) {
      return NextResponse.json({ error: "Type and data are required" }, { status: 400 })
    }

    // Получаем максимальную позицию
    const maxPosition = await prisma.reportBlock.findFirst({
      where: { reportId },
      orderBy: { position: "desc" },
      select: { position: true },
    })

    const position = body.position ?? (maxPosition?.position ?? 0) + 1

    const block = await prisma.reportBlock.create({
      data: {
        reportId,
        type: body.type,
        position,
        data: body.data,
      },
    })

    return NextResponse.json({ block }, { status: 201 })
  } catch (error) {
    console.error("Error creating block:", error)
    return NextResponse.json({ error: "Failed to create block" }, { status: 500 })
  }
}
