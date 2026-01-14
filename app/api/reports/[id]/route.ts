import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { UpdateReportInput } from "@/lib/db-types"

// GET /api/reports/[id] - получить отчет по ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        blocks: {
          orderBy: { position: "asc" },
        },
      },
    })

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    return NextResponse.json({ report }, { status: 200 })
  } catch (error) {
    console.error("Error fetching report:", error)
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 })
  }
}

// PATCH /api/reports/[id] - обновить отчет
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body: Partial<UpdateReportInput> = await request.json()

    const report = await prisma.report.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.subtitle !== undefined && { subtitle: body.subtitle }),
        ...(body.client !== undefined && { client: body.client }),
        ...(body.date !== undefined && { date: body.date }),
        ...(body.status !== undefined && { status: body.status }),
      },
    })

    return NextResponse.json({ report }, { status: 200 })
  } catch (error) {
    console.error("Error updating report:", error)
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 })
  }
}

// DELETE /api/reports/[id] - удалить отчет
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    await prisma.report.delete({
      where: { id },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error deleting report:", error)
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 })
  }
}
