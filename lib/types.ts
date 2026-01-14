export interface ReportMeta {
  title: string
  subtitle?: string
  client?: string
  date?: string
}

export interface ScreenshotBlock {
  id: string
  type: "screenshot"
  title: string
  description: string
  images: string[] // DataURL/base64
  layout?: "full-width" | "sidebar" // на всю ширину или сбоку
  imageSize?: "small" | "medium" | "large" // размер изображений
  customWidth?: string // опциональная ширина (напр. "800px", "90%")
}

export interface TextBlock {
  id: string
  type: "text"
  title: string
  content: string
  fontSize?: "small" | "medium" | "large" // размер текста
}

export type ReportBlock = ScreenshotBlock | TextBlock

export interface ReportDraft {
  meta: ReportMeta
  blocks: ReportBlock[]
}
