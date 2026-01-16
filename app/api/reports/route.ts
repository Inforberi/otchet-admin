import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { CreateReportInput } from "@/lib/db-types"
import type { Prisma } from "@prisma/client"

// GET /api/reports - список всех отчетов
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search")
    const dateSearch = searchParams.get("date")

    const where: Prisma.ReportWhereInput = {}
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { client: { contains: search, mode: "insensitive" } },
      ]
    }

    if (dateSearch) {
      where.date = { contains: dateSearch, mode: "insensitive" }
    }

    const reports = await prisma.report.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: [
        { date: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        blocks: {
          orderBy: { position: "asc" },
        },
      },
    })
    
    // Сортируем: сначала по date (null в конец), затем по createdAt
    reports.sort((a, b) => {
      if (!a.date && !b.date) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (!a.date) return 1
      if (!b.date) return -1
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
