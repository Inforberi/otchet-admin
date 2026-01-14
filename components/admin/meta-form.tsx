"use client"

import type { ReportMeta } from "@/lib/types"

interface MetaFormProps {
  meta: ReportMeta
  onChange: (meta: ReportMeta) => void
}

export function MetaForm({ meta, onChange }: MetaFormProps) {
  const handleChange = (field: keyof ReportMeta, value: string) => {
    onChange({ ...meta, [field]: value })
  }

  return (
    <div className="rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-6">
      <h2 className="mb-4 text-lg font-semibold text-[var(--color-grayscale-3)]">Метаданные отчёта</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm text-[var(--color-grayscale-6)]">Название отчёта *</label>
          <input
            type="text"
            value={meta.title}
            onChange={(e) => handleChange("title", e.target.value)}
            placeholder="Отчёт по аудиту сайта"
            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm text-[var(--color-grayscale-6)]">Подзаголовок</label>
          <input
            type="text"
            value={meta.subtitle || ""}
            onChange={(e) => handleChange("subtitle", e.target.value)}
            placeholder="Анализ производительности и SEO"
            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-[var(--color-grayscale-6)]">Клиент</label>
          <input
            type="text"
            value={meta.client || ""}
            onChange={(e) => handleChange("client", e.target.value)}
            placeholder="ООО «Компания»"
            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-[var(--color-grayscale-6)]">Дата</label>
          <input
            type="text"
            value={meta.date || ""}
            onChange={(e) => handleChange("date", e.target.value)}
            placeholder="Январь 2026"
            className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}
