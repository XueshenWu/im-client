/**
 * Crop image utility using Canvas API
 * Based on react-easy-crop's documentation
 */

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Creates a cropped image from the source image
 * @param imageSrc - Source image URL
 * @param pixelCrop - Crop area in pixels
 * @param format - Output format (jpeg, png)
 * @param quality - JPEG quality (0-1)
 * @returns Promise that resolves to a Blob of the cropped image
 */
export const createCroppedImage = async (
  imageSrc: string,
  pixelCrop: CropArea,
  format: 'jpeg' | 'png' = 'jpeg',
  quality: number = 0.95
): Promise<Blob> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Set canvas size to match crop area
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Draw the cropped portion of the image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
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
 * Helper function to create an Image element from a URL
 * @param url - Image URL
 * @returns Promise that resolves to an HTMLImageElement
 */
const createImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); // Needed to avoid CORS issues
    image.src = url;
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
