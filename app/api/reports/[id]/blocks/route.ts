import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { CreateBlockInput } from "@/lib/db-types"
import { Prisma } from "@prisma/client"
import { requireEditorMiddleware } from "@/lib/auth-helpers"

const VERSION_CONFLICT = "VERSION_CONFLICT"

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
  // Проверка прав администратора
  const adminCheck = await requireEditorMiddleware(request);
  if (adminCheck) return adminCheck;

  try {
    const { id: reportId } = await params
    const body: Omit<CreateBlockInput, "reportId"> & { expectedReportVersion?: number } = await request.json()
    const expectedReportVersion =
      typeof body.expectedReportVersion === "number"
        ? body.expectedReportVersion
        : Number(body.expectedReportVersion)

    if (!body.type || !body.data) {
      return NextResponse.json({ error: "Type and data are required" }, { status: 400 })
    }

    if (!Number.isInteger(expectedReportVersion) || expectedReportVersion < 1) {
      return NextResponse.json({ error: "expectedReportVersion is required" }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId },
        select: { id: true, version: true },
      })

      if (!report) {
        throw new Error("REPORT_NOT_FOUND")
      }

      if (report.version !== expectedReportVersion) {
        throw new Error(VERSION_CONFLICT)
      }

      const maxPosition = await tx.reportBlock.findFirst({
        where: { reportId },
        orderBy: { position: "desc" },
        select: { position: true },
      })

      const block = await tx.reportBlock.create({
        data: {
          reportId,
          type: body.type,
          parentId: body.parentId ?? null,
          position: (maxPosition?.position ?? -1) + 1,
          data: body.data as Prisma.InputJsonValue,
        },
      })

      await tx.report.update({
        where: { id: reportId },
        data: {
          version: {
            increment: 1,
          },
        },
      })

      return {
        block,
        reportVersion: report.version + 1,
      }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === VERSION_CONFLICT) {
        return NextResponse.json(
          { error: "Report has been modified by another user", code: VERSION_CONFLICT },
          { status: 409 }
        )
      }

      if (error.message === "REPORT_NOT_FOUND") {
        return NextResponse.json({ error: "Report not found" }, { status: 404 })
      }
    }

    console.error("Error creating block:", error)
    return NextResponse.json({ error: "Failed to create block" }, { status: 500 })
  }
}
