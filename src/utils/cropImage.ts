/**
 * Crop image utility using Canvas API
 * For use with react-image-crop
 */

import type { PixelCrop } from 'react-image-crop';

/**
 * Creates a cropped image from an HTMLImageElement
 * @param image - Source image element
 * @param crop - Crop area in pixels from react-image-crop
 * @param format - Output format (jpeg, png)
 * @param quality - JPEG quality (0-1)
 * @returns Promise that resolves to a Blob of the cropped image
 */
export const createCroppedImage = async (
  image: HTMLImageElement,
  crop: PixelCrop,
  format: 'jpeg' | 'png' = 'jpeg',
  quality: number = 0.95
): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Calculate scale between displayed image and natural size
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  // Set canvas size to match crop area at natural resolution
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;

  // Draw the cropped portion of the image
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  // Convert canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas is empty'));
        }
      },
      `image/${format}`,
      quality
    );
  });
};

/**
 * Convert a Blob to a File
 * @param blob - Blob to convert
 * @param filename - Desired filename
 * @returns File object
 */
export const blobToFile = (blob: Blob, filename: string): File => {
  return new File([blob], filename, { type: blob.type });
};
