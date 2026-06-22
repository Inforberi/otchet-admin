export const GROUP_REPORTS_SEGMENT = 'reports'

export const RESERVED_ROOT_GROUP_SLUGS = new Set([
  'api',
  'admin',
  'groups',
  'login',
  'report',
  'reports',
])

export const buildGroupPath = (parentPath: string | null | undefined, slug: string) => {
  return parentPath ? `${parentPath}/${slug}` : slug
}

export const splitGroupPath = (path: string | null | undefined) => {
  if (!path) return []
  return path.split('/').filter(Boolean)
}

export const joinGroupPath = (segments: string[]) => {
  return segments.filter(Boolean).join('/')
}

export const getIndentedGroupLabel = (name: string, depth: number) => {
  return `${'  '.repeat(depth)}${name}`
}

type GroupTreeNode = {
  id: string
  name: string
  path: string
  parentId: string | null
}

export type FlatGroupTreeItem = GroupTreeNode & { depth: number }

export const buildFlatGroupTree = <T extends GroupTreeNode>(
  groups: T[]
): Array<T & { depth: number }> => {
  const childrenByParent = new Map<string | null, T[]>()

  groups.forEach((group) => {
    const siblings = childrenByParent.get(group.parentId) || []
    siblings.push(group)
    childrenByParent.set(group.parentId, siblings)
  })

  const sortGroups = (items: T[]) =>
    [...items].sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  const result: Array<T & { depth: number }> = []

  const walk = (parentId: string | null, depth: number) => {
    sortGroups(childrenByParent.get(parentId) || []).forEach((item) => {
      result.push({ ...item, depth })
      walk(item.id, depth + 1)
    })
  }

  walk(null, 0)
  return result
}

export const getSubtreeIdsByParent = <T extends { id: string; parentId: string | null }>(
  groupId: string,
  groups: T[]
): string[] => {
  const childrenByParent = new Map<string | null, T[]>()

  groups.forEach((group) => {
    const siblings = childrenByParent.get(group.parentId) || []
    siblings.push(group)
    childrenByParent.set(group.parentId, siblings)
  })

  const result: string[] = []
  const walk = (id: string) => {
    result.push(id)
    ;(childrenByParent.get(id) || []).forEach((child) => walk(child.id))
  }

  walk(groupId)
  return result
}

export const isReservedGroupSlug = (slug: string, parentPath?: string | null) => {
  if (slug === GROUP_REPORTS_SEGMENT) {
    return true
  }

  if (!parentPath && RESERVED_ROOT_GROUP_SLUGS.has(slug)) {
    return true
  }

  return false
}
