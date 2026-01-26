import type { ImageFilter } from '../types';

// Built-in grayscale filter
export const grayscaleFilter: ImageFilter = {
  id: 'grayscale',
  label: 'Grayscale',
  cssFilter: () => 'grayscale(100%)',
};

// Built-in sepia filter
export const sepiaFilter: ImageFilter = {
  id: 'sepia',
  label: 'Sepia',
  cssFilter: () => 'sepia(100%)',
};

// Built-in invert filter
export const invertFilter: ImageFilter = {
  id: 'invert',
  label: 'Invert',
  cssFilter: () => 'invert(100%)',
};

// Built-in brightness filter with adjustable parameter
export const brightnessFilter: ImageFilter = {
  id: 'brightness',
  label: 'Brightness',
  cssFilter: (params) => `brightness(${params?.amount ?? 100}%)`,
  defaultParams: { amount: 100 },
  paramConfig: [
    {
      key: 'amount',
      label: 'Amount',
      min: 0,
      max: 200,
      step: 5,
      default: 100,
    },
  ],
};

// Built-in contrast filter with adjustable parameter
export const contrastFilter: ImageFilter = {
  id: 'contrast',
  label: 'Contrast',
  cssFilter: (params) => `contrast(${params?.amount ?? 100}%)`,
  defaultParams: { amount: 100 },
  paramConfig: [
    {
      key: 'amount',
      label: 'Amount',
      min: 0,
      max: 200,
      step: 5,
      default: 100,
    },
  ],
};

// Built-in blur filter with adjustable parameter
export const blurFilter: ImageFilter = {
  id: 'blur',
  label: 'Blur',
  cssFilter: (params) => `blur(${params?.amount ?? 0}px)`,
  defaultParams: { amount: 0 },
  paramConfig: [
    {
      key: 'amount',
      label: 'Amount',
      min: 0,
      max: 20,
      step: 1,
      default: 0,
    },
  ],
};

// Built-in saturate filter with adjustable parameter
export const saturateFilter: ImageFilter = {
  id: 'saturate',
  label: 'Saturation',
  cssFilter: (params) => `saturate(${params?.amount ?? 100}%)`,
  defaultParams: { amount: 100 },
  paramConfig: [
    {
      key: 'amount',
      label: 'Amount',
      min: 0,
      max: 200,
      step: 5,
      default: 100,
    },
  ],
};

// Default built-in filters
export const builtInFilters: ImageFilter[] = [
  grayscaleFilter,
  sepiaFilter,
  invertFilter,
  brightnessFilter,
  contrastFilter,
  saturateFilter,
  blurFilter,
];

// Helper function to apply filter to canvas and return blob
export async function applyFilterToImage(
  image: HTMLImageElement,
  filter: ImageFilter,
  params: Record<string, number>,
  format: 'jpeg' | 'png' = 'jpeg'
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  // Apply CSS filter if defined
  if (filter.cssFilter) {
    ctx.filter = filter.cssFilter(params);
  }

  // Draw the image
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // Apply custom canvas manipulation if defined
  if (filter.applyToCanvas) {
    filter.applyToCanvas(ctx, image, params);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas is empty'));
        }
      },
      `image/${format}`
    );
  });
}
