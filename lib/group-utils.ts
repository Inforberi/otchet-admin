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

export const isReservedGroupSlug = (slug: string, parentPath?: string | null) => {
  if (slug === GROUP_REPORTS_SEGMENT) {
    return true
  }

  if (!parentPath && RESERVED_ROOT_GROUP_SLUGS.has(slug)) {
    return true
  }

  return false
}
