import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/context/AuthContext'
import type { DocumentEntityType, DocumentRecord } from '@/types/database'

const BUCKET = 'documents'

export function useDocuments(entityType: DocumentEntityType, entityId: string | undefined) {
  return useQuery({
    queryKey: ['documents', entityType, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as DocumentRecord[]
    },
  })
}

export function useUploadDocument() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ entityType, entityId, file }: { entityType: DocumentEntityType; entityId: string; file: File }) => {
      if (!user) throw new Error('Sem sessão ativa')
      const path = `${user.id}/${entityType}/${entityId}/${crypto.randomUUID()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
      if (uploadError) throw uploadError
      const { error } = await supabase.from('documents').insert({
        entity_type: entityType,
        entity_id: entityId,
        storage_path: path,
        filename: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      })
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['documents', vars.entityType, vars.entityId] }),
  })
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: async (doc: DocumentRecord) => {
      const { data, error } = await supabase.storage.from(BUCKET).download(doc.storage_path)
      if (error) throw error
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    },
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (doc: DocumentRecord) => {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([doc.storage_path])
      if (storageError) throw storageError
      const { error } = await supabase.from('documents').delete().eq('id', doc.id)
      if (error) throw error
    },
    onSuccess: (_, doc) => qc.invalidateQueries({ queryKey: ['documents', doc.entity_type, doc.entity_id] }),
  })
}
