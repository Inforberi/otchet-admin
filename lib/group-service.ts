import { prisma } from '@/lib/prisma'
import { createSlug, generateUniqueSlug } from '@/lib/slug'
import {
  GROUP_REPORTS_SEGMENT,
  buildGroupPath,
  joinGroupPath,
  isReservedGroupSlug,
  splitGroupPath,
} from '@/lib/group-utils'

const getPathDepth = (path: string) => splitGroupPath(path).length

export const generateGroupSlugAndPath = async ({
  name,
  parentId,
  currentGroupId,
}: {
  name: string
  parentId?: string | null
  currentGroupId?: string
}) => {
  const normalizedName = name.trim()
  const parent = parentId
    ? await prisma.reportGroup.findUnique({
        where: { id: parentId },
        select: { id: true, path: true },
      })
    : null

  if (parentId && !parent) {
    throw new Error('PARENT_NOT_FOUND')
  }

  const baseSlug = createSlug(normalizedName)
  if (isReservedGroupSlug(baseSlug, parent?.path ?? null)) {
    throw new Error(
      baseSlug === GROUP_REPORTS_SEGMENT
        ? 'RESERVED_GROUP_SLUG'
        : 'RESERVED_ROOT_GROUP_SLUG'
    )
  }

  const slug = await generateUniqueSlug(baseSlug, async (candidateSlug) => {
    const candidatePath = buildGroupPath(parent?.path ?? null, candidateSlug)
    const existing = await prisma.reportGroup.findUnique({
      where: { path: candidatePath },
      select: { id: true },
    })

    return !existing || existing.id === currentGroupId
  })

  return {
    slug,
    path: buildGroupPath(parent?.path ?? null, slug),
    parent,
  }
}

export const getGroupAncestors = async (parentId: string | null) => {
  const ancestors: Array<{ id: string; name: string; slug: string; path: string }> = []
  let currentParentId = parentId

  while (currentParentId) {
    const parent = await prisma.reportGroup.findUnique({
      where: { id: currentParentId },
      select: { id: true, name: true, slug: true, path: true, parentId: true },
    })

    if (!parent) break

    ancestors.unshift({
      id: parent.id,
      name: parent.name,
      slug: parent.slug,
      path: parent.path,
    })

    currentParentId = parent.parentId
  }

  return ancestors
}

export const resolveGroupByPath = async (segments: string[]) => {
  const path = joinGroupPath(segments)
  if (!path) return null

  return prisma.reportGroup.findUnique({
    where: { path },
    include: {
      _count: {
        select: {
          reports: true,
          children: true,
        },
      },
      children: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        include: {
          _count: {
            select: {
              reports: true,
              children: true,
            },
          },
        },
      },
    },
  })
}

export const ensureNoGroupCycle = async (groupId: string, nextParentId: string | null) => {
  if (!nextParentId) return
  if (nextParentId === groupId) {
    throw new Error('GROUP_CYCLE')
  }

  const currentGroup = await prisma.reportGroup.findUnique({
    where: { id: groupId },
    select: { path: true },
  })

  const nextParent = await prisma.reportGroup.findUnique({
    where: { id: nextParentId },
    select: { path: true },
  })

  if (!currentGroup || !nextParent) {
    throw new Error('PARENT_NOT_FOUND')
  }

  if (
    nextParent.path === currentGroup.path ||
    nextParent.path.startsWith(`${currentGroup.path}/`)
  ) {
    throw new Error('GROUP_CYCLE')
  }
}

export const updateGroupPathBranch = async ({
  groupId,
  oldPath,
  newPath,
  rootUpdateData,
}: {
  groupId: string
  oldPath: string
  newPath: string
  rootUpdateData?: Record<string, unknown>
}) => {
  if (oldPath === newPath) {
    if (rootUpdateData) {
      await prisma.reportGroup.update({
        where: { id: groupId },
        data: {
          ...rootUpdateData,
          path: newPath,
        },
      })
    }
    return
  }

  const descendants = await prisma.reportGroup.findMany({
    where: {
      path: {
        startsWith: `${oldPath}/`,
      },
    },
    select: {
      id: true,
      slug: true,
      parentId: true,
      path: true,
    },
  })

  const nextPathById = new Map<string, string>([[groupId, newPath]])
  const sortedDescendants = descendants.sort(
    (a, b) => getPathDepth(a.path) - getPathDepth(b.path)
  )

  await prisma.$transaction(async (tx) => {
    await tx.reportGroup.update({
      where: { id: groupId },
      data: {
        ...(rootUpdateData ?? {}),
        path: newPath,
      },
    })

    for (const descendant of sortedDescendants) {
      const parentPath = descendant.parentId
        ? nextPathById.get(descendant.parentId) ?? null
        : null
      const nextPath = buildGroupPath(parentPath, descendant.slug)

      nextPathById.set(descendant.id, nextPath)

      await tx.reportGroup.update({
        where: { id: descendant.id },
        data: { path: nextPath },
      })
    }
  })
}
