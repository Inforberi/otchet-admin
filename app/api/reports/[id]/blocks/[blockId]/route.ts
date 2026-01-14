import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { UpdateBlockInput } from "@/lib/db-types"

// PATCH /api/reports/[id]/blocks/[blockId] - обновить блок
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> },
) {
  try {
    const { blockId } = await params
    const body: Partial<UpdateBlockInput> = await request.json()

    const block = await prisma.reportBlock.update({
      where: { id: blockId },
      data: {
        ...(body.data !== undefined && { data: body.data }),
        ...(body.position !== undefined && { position: body.position }),
      },
    })

    return NextResponse.json({ block }, { status: 200 })
  } catch (error) {
    console.error("Error updating block:", error)
    return NextResponse.json({ error: "Failed to update block" }, { status: 500 })
  }
}

// DELETE /api/reports/[id]/blocks/[blockId] - удалить блок
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> },
) {
  try {
    const { blockId } = await params

    await prisma.reportBlock.delete({
      where: { id: blockId },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error deleting block:", error)
    return NextResponse.json({ error: "Failed to delete block" }, { status: 500 })
  }
}
