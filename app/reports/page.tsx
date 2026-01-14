"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, FileText, Search, Trash2, Eye, Edit, Calendar, User } from "lucide-react"
import type { ReportFromDB } from "@/lib/db-types"

export default function ReportsListPage() {
  const router = useRouter()
  const [reports, setReports] = useState<ReportFromDB[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    try {
      setLoading(true)
      const params = search ? `?search=${encodeURIComponent(search)}` : ""
      const response = await fetch(`/api/reports${params}`)
      const data = await response.json()
      setReports(data.reports || [])
    } catch (error) {
      console.error("Error loading reports:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    loadReports()
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/reports/${id}`, {
        method: "DELETE",
      })
      if (response.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id))
        setDeleteConfirm(null)
      }
    } catch (error) {
      console.error("Error deleting report:", error)
    }
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="min-h-screen bg-[var(--color-grayscale-16)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)]/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-grayscale-2)]">Отчеты</h1>
              <p className="mt-1 text-sm text-[var(--color-grayscale-6)]">
                Управление отчетами и создание новых
              </p>
            </div>
            <button
              onClick={() => router.push("/reports/new")}
              className="flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
            >
              <Plus className="h-5 w-5" />
              Создать отчет
            </button>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-grayscale-6)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Поиск по названию или клиенту..."
              className="w-full rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] py-2 pl-10 pr-4 text-[var(--color-grayscale-3)] placeholder:text-[var(--color-grayscale-8)] focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>
          <button
            onClick={handleSearch}
            className="rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] px-4 py-2 text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)]"
          >
            Найти
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-[var(--color-grayscale-6)]">Загрузка...</div>
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-6 py-16 text-center">
            <FileText className="mx-auto h-12 w-12 text-[var(--color-grayscale-6)]" />
            <h3 className="mt-4 text-lg font-semibold text-[var(--color-grayscale-3)]">Отчеты не найдены</h3>
            <p className="mt-2 text-[var(--color-grayscale-6)]">
              {search ? "Попробуйте изменить параметры поиска" : "Создайте первый отчет"}
            </p>
            {!search && (
              <button
                onClick={() => router.push("/reports/new")}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Создать отчет
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="group relative overflow-hidden rounded-lg border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-14)] p-6 transition-all hover:border-[var(--color-primary)] hover:shadow-lg"
              >
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-[var(--color-grayscale-2)] line-clamp-2">
                    {report.title}
                  </h3>
                  {report.subtitle && (
                    <p className="mt-1 text-sm text-[var(--color-grayscale-6)] line-clamp-1">{report.subtitle}</p>
                  )}
                </div>

                <div className="space-y-2 text-sm text-[var(--color-grayscale-6)]">
                  {report.client && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{report.client}</span>
                    </div>
                  )}
                  {report.date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{report.date}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>{report.blocks?.length || 0} блоков</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-grayscale-7)]">
                  <span>Обновлен: {formatDate(report.updatedAt)}</span>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => router.push(`/reports/${report.id}`)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-md border border-[var(--color-alpha-3)] bg-[var(--color-grayscale-15)] px-3 py-2 text-sm text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-13)]"
                  >
                    <Eye className="h-4 w-4" />
                    Просмотр
                  </button>
                  <button
                    onClick={() => router.push(`/reports/${report.id}/edit`)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  >
                    <Edit className="h-4 w-4" />
                    Редактор
                  </button>
                </div>

                {/* Delete */}
                {deleteConfirm === report.id ? (
                  <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 p-3">
                    <p className="mb-2 text-sm text-red-400">Точно удалить?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(report.id)}
                        className="flex-1 rounded bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                      >
                        Да, удалить
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="flex-1 rounded bg-[var(--color-grayscale-13)] px-3 py-1.5 text-sm text-[var(--color-grayscale-4)] transition-colors hover:bg-[var(--color-grayscale-12)]"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(report.id)}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Удалить
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
