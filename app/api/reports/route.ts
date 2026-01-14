import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { CreateReportInput } from "@/lib/db-types"

// GET /api/reports - список всех отчетов
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search")

    const reports = await prisma.report.findMany({
      where: search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { client: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { updatedAt: "desc" },
      include: {
        blocks: {
          orderBy: { position: "asc" },
        },
      },
    })

    return NextResponse.json({ reports }, { status: 200 })
  } catch (error) {
    console.error("Error fetching reports:", error)
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 })
  }
}

// POST /api/reports - создание нового отчета
export async function POST(request: NextRequest) {
  try {
    const body: CreateReportInput = await request.json()

    if (!body.title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const report = await prisma.report.create({
      data: {
        title: body.title,
        subtitle: body.subtitle,
        client: body.client,
        date: body.date,
        status: body.status || "draft",
      },
    })

    return NextResponse.json({ report }, { status: 201 })
  } catch (error) {
    console.error("Error creating report:", error)
    return NextResponse.json({ error: "Failed to create report" }, { status: 500 })
  }
}
