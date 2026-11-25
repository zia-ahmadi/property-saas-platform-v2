import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, ImagePlus, Trash2, Upload, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOrganization } from '@/features/organization/context'
import { ApiError } from '@/lib/api/errors'

type ImageResource = 'property' | 'unit' | 'renter'
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png']

function imageError(error: unknown) {
  if (error instanceof ApiError && error.status === 413) return 'Images must be 5 MB or smaller.'
  if (error instanceof ApiError && error.status === 400) return 'Choose a valid JPEG or PNG image.'
  if (error instanceof ApiError && error.status === 403) return 'You do not have permission to manage this image.'
  return 'The image could not be saved or loaded. Please try again.'
}

export function OrganizationImage({
  resourceType,
  resourceId,
  alt,
  canManage = false,
  editable = true,
  className = '',
  thumbnail = false,
}: {
  resourceType: ImageResource
  resourceId: string
  alt: string
  canManage?: boolean
  editable?: boolean
  className?: string
  thumbnail?: boolean
}) {
  const org = useOrganization()
  const client = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const imageElement = useRef<HTMLImageElement>(null)
  const [uploadError, setUploadError] = useState('')
  const queryKey = org.queryKey(['organization-image', resourceType, resourceId])
  const path = `images/${resourceType}/${resourceId}`
  const image = useQuery({
    queryKey,
    queryFn: async ({ signal }) =>
      (await org.request<Blob | undefined>('get', path, undefined, {
        headers: { Accept: 'image/*' },
        responseType: 'blob',
        signal,
      })) ?? null,
    enabled: !!resourceId,
    retry: false,
  })

  const imageBlob = image.data instanceof Blob ? image.data : null
  useEffect(() => {
    if (!imageBlob || typeof URL.createObjectURL !== 'function') return
    const url = URL.createObjectURL(imageBlob)
    if (imageElement.current) imageElement.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [imageBlob, thumbnail])

  const upload = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData()
      body.set('file', file)
      return org.request<void>('put', path, body, { timeoutMs: 60_000 })
    },
    onSuccess: async () => {
      setUploadError('')
      if (input.current) input.current.value = ''
      await client.invalidateQueries({ queryKey })
    },
    onError: (error) => setUploadError(imageError(error)),
  })
  const remove = useMutation({
    mutationFn: () => org.request<void>('delete', path),
    onSuccess: async () => {
      setUploadError('')
      await client.invalidateQueries({ queryKey })
    },
    onError: (error) => setUploadError(imageError(error)),
  })

  function chooseFile(file: File | undefined) {
    if (!file) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setUploadError('Choose a JPEG or PNG image.')
      if (input.current) input.current.value = ''
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setUploadError('Images must be 5 MB or smaller.')
      if (input.current) input.current.value = ''
      return
    }
    setUploadError('')
    upload.mutate(file)
  }

  if (thumbnail) {
    const Icon = resourceType === 'renter' ? UserRound : Building2
    return <span className={`size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-accent text-primary ${className || 'inline-flex'}`} aria-hidden="true">
      {imageBlob ? <img ref={imageElement} alt="" className="size-full object-cover" /> : <Icon className="size-4" />}
    </span>
  }

  const saving = upload.isPending || remove.isPending
  const error = uploadError || (image.isError ? imageError(image.error) : '')

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl border bg-muted/40">
        {imageBlob ? (
          <img ref={imageElement} alt={alt} className="size-full object-cover" />
        ) : (
          <div
            role="img"
            aria-label={`${alt}: ${image.isError ? 'image unavailable' : 'no image uploaded'}`}
            className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground"
          >
            <ImagePlus aria-hidden="true" className="size-8" />
            <span className="text-sm">{image.isError ? 'Image unavailable' : 'No image uploaded'}</span>
          </div>
        )}
      </div>
      {canManage && editable && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png"
            aria-label={`Upload image for ${alt}`}
            disabled={saving}
            onChange={(event) => chooseFile(event.currentTarget.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => input.current?.click()}
          >
            <Upload aria-hidden="true" className="size-4" />
            {saving ? 'Saving…' : imageBlob ? 'Replace image' : 'Upload image'}
          </Button>
          {imageBlob && (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                if (window.confirm(`Remove the image for ${alt}?`)) remove.mutate()
              }}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Remove image
            </Button>
          )}
        </div>
      )}
      {image.isError && (
        <Button type="button" variant="outline" disabled={image.isFetching} onClick={() => void image.refetch()}>
          {image.isFetching ? 'Retrying…' : 'Retry image'}
        </Button>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
