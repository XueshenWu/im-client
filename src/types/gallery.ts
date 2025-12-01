import type { Image } from './api'

export type ImageSource = 'local' | 'cloud'

export interface ImageWithSource extends Image {
  source: ImageSource
  aspectRatio?: number
}


export type ImageItem = ImageWithSource
