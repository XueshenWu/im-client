import type { Image } from './api'

export type ImageSource = 'local' | 'cloud'

export interface ImageItem {
  // Common fields
  id?: string // For cloud images, this will be the image ID; for local, it's the path
  path?: string // For local images
  preview?: string
  aspectRatio?: number
  source: ImageSource

  // Local image fields
  name?: string
  size?: number
  createdAt?: string
  modifiedAt?: string

  // Cloud image fields (from API)
  cloudData?: Image
}
