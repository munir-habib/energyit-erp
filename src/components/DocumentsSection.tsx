import { useRef } from 'react'
import { useDeleteDocument, useDocuments, useDownloadDocument, useUploadDocument } from '@/hooks/useDocuments'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/format'
import type { DocumentEntityType } from '@/types/database'

export function DocumentsSection({ entityType, entityId }: { entityType: DocumentEntityType; entityId: string }) {
  const { data: documents } = useDocuments(entityType, entityId)
  const upload = useUploadDocument()
  const download = useDownloadDocument()
  const del = useDeleteDocument()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {(documents ?? []).map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2 text-sm dark:bg-surface-dark-muted"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800 dark:text-slate-100">{d.filename}</p>
              <p className="text-xs text-slate-400">{formatDate(d.created_at)}</p>
            </div>
            <div className="flex shrink-0 gap-3">
              <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => download.mutate(d)}>
                Transferir
              </button>
              <button
                type="button"
                className="text-xs font-medium text-danger hover:underline"
                onClick={() => confirm(`Eliminar "${d.filename}"? Esta ação não pode ser revertida.`) && del.mutate(d)}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {(documents ?? []).length === 0 && <p className="text-sm text-slate-400">Sem documentos anexados.</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload.mutate({ entityType, entityId, file })
          e.target.value = ''
        }}
      />
      <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
        {upload.isPending ? 'A carregar…' : '+ Anexar documento'}
      </Button>
    </div>
  )
}
