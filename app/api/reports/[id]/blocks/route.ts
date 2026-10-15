import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { appendBlocksSchema } from "@/lib/report-api"
import { validationErrorResponse } from "@/lib/api-validation"
import { buildDraftPayload, computeDraftHash } from "@/lib/draft-hash"
import type { ReportBlockFromDB } from "@/lib/db-types"
import { Prisma } from "@prisma/client"
import {
  getRequestUser,
  isViewerRole,
  requireEditorMiddleware,
} from "@/lib/auth-helpers"
import {
  canAccessReportId,
  getReportAccessOptionsFromRequest,
} from "@/lib/report-access"
import { getGroupAccessOptionsFromRequest } from "@/lib/group-access"

const VERSION_CONFLICT = "VERSION_CONFLICT"

// GET /api/reports/[id]/blocks - получить все блоки отчета
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getRequestUser(request)
    const accessOptions = {
      ...getGroupAccessOptionsFromRequest(request),
      ...getReportAccessOptionsFromRequest(request),
    }

    if (!user) {
      return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 })
    }

    if (isViewerRole(user) || !(await canAccessReportId(id, user, accessOptions))) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

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
    const user = await getRequestUser(request)
    const accessOptions = {
      ...getGroupAccessOptionsFromRequest(request),
      ...getReportAccessOptionsFromRequest(request),
    }

    if (!(await canAccessReportId(reportId, user, accessOptions))) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const body = appendBlocksSchema.parse(await request.json())
    const { expectedReportVersion } = body
    const inputs = 'blocks' in body ? body.blocks : [body]

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

      // Условное обновление блокирует строку отчета до конца транзакции.
      // Проигравший параллельный запрос не записывает ни одного блока.
      const claimed = await tx.report.updateMany({
        where: { id: reportId, version: expectedReportVersion },
        data: { version: { increment: 1 }, draftUpdatedAt: new Date() },
      })
      if (claimed.count !== 1) throw new Error(VERSION_CONFLICT)

      const parentIds = [...new Set(inputs.flatMap((input) => input.parentId ? [input.parentId] : []))]
      const parents = await tx.reportBlock.findMany({
        where: { reportId, id: { in: parentIds }, type: 'section', parentId: null },
        select: { id: true },
      })
      if (parents.length !== parentIds.length || inputs.some((input) => input.type === 'section' && input.parentId)) {
        throw new Error('INVALID_PARENT')
      }

      const blocks = []
      for (const [index, input] of inputs.entries()) {
        blocks.push(await tx.reportBlock.create({
          data: {
            reportId,
            type: input.type,
            parentId: input.parentId ?? null,
            position: (maxPosition?.position ?? -1) + 1 + index,
            data: input.data as Prisma.InputJsonValue,
          },
        }))
      }

      const draft = await tx.report.findUniqueOrThrow({
        where: { id: reportId },
        include: { blocks: { orderBy: { position: 'asc' } } },
      })
      await tx.report.update({
        where: { id: reportId },
        data: { draftHash: await computeDraftHash(buildDraftPayload(draft, draft.blocks as ReportBlockFromDB[])) },
      })

      return 'blocks' in body
        ? { blocks, reportVersion: report.version + 1 }
        : { block: blocks[0], reportVersion: report.version + 1 }

    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const validationError = validationErrorResponse(error)
    if (validationError) return validationError
    if (error instanceof Error && error.message === 'INVALID_PARENT') {
      return NextResponse.json({ error: 'parentId должен ссылаться на секцию этого отчета' }, { status: 400 })
    }
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
