import type { Image } from './api'

export type ImageSource = 'local' | 'cloud'

export interface ImageItem {
  // Common fields
  id?: string // UUID for both local and cloud images
  aspectRatio?: number
  source: ImageSource

  // Local image fields
  name?: string
  size?: number
  format?: string // File format extension (jpg, png, etc.)
  createdAt?: string
  modifiedAt?: string

  // Cloud image fields (from API)
  cloudData?: Image
}
