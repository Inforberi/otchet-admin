import { NextRequest, NextResponse } from 'next/server'
import { getGroupAncestors, resolveGroupByPath } from '@/lib/group-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params
    const group = await resolveGroupByPath(path)

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    const ancestors = await getGroupAncestors(group.parentId)

    return NextResponse.json({ group, ancestors }, { status: 200 })
  } catch (error) {
    console.error('Error resolving group by path:', error)
    return NextResponse.json(
      { error: 'Failed to resolve group' },
      { status: 500 }
    )
  }
}
