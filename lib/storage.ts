import type { ReportDraft } from "./types"

const STORAGE_KEY = "report_draft"

export const getDefaultDraft = (): ReportDraft => ({
  meta: {
    title: "",
    subtitle: "",
    client: "",
    date: "",
  },
  blocks: [],
})

export const saveReport = (draft: ReportDraft): void => {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch (error) {
    console.error("Ошибка сохранения в localStorage:", error)
  }
}

export const loadReport = (): ReportDraft | null => {
  if (typeof window === "undefined") return null
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return null
    return JSON.parse(data) as ReportDraft
  } catch (error) {
    console.error("Ошибка загрузки из localStorage:", error)
    return null
  }
}

export const clearReport = (): void => {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
