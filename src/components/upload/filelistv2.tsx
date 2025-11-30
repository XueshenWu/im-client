import React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { X, FileText, ArrowUpDown, Image as ImageIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import withDropzone, { WithDropzoneProps, FileWithPreview } from '@/components/upload/dropzone';
import {
  requestPresignedURLs,
  uploadToPresignedURL,
} from '@/services/images.service';
import type { Image } from '@/types/api';
import { useSettingsStore } from '@/stores/settingsStore';
import { localImageService } from '@/services/localImage.service';
import { LocalImage } from '@/types/local';
import { useGalleryRefreshStore } from '@/stores/galleryRefreshStore';
import { generateThumbnail, generateThumbnailBlob } from '@/utils/thumbnailGenerator';
import { v4 as uuidv4 } from 'uuid';
import exifr from 'exifr';
import { normalizeFormatFromMimeType, normalizeFormatFromFilename } from '@/utils/formatNormalizer';



// Upload status tracking
interface UploadStatus {
  fileName: string;
  progress: number;
  status: 'staged' | 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
  isCorrupted?: boolean;
}

// Upload statistics tracking
interface UploadStatistics {
  totalFiles: number;
  totalSize: number;
  corruptedCount: number;
}

/**
 * Check if an image file is corrupted by attempting to load it
 */
const checkImageCorruption = async (file: File): Promise<boolean> => {
  // Only check image files
  if (!file.type.startsWith('image/')) {
    return false;
  }

  try {
    // For TIFF files, we can't reliably check in browser
    const isTiff = file.type === 'image/tiff' || file.type === 'image/tif' ||
                   file.name.toLowerCase().endsWith('.tiff') ||
                   file.name.toLowerCase().endsWith('.tif');

    if (isTiff) {
      // TIFF corruption will be detected during Electron processing
      return false;
    }

    // For other image types, try to load them
    const imageUrl = URL.createObjectURL(file);
    const img = new Image();

    const isCorrupted = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(imageUrl);
        resolve(true); // Timeout means likely corrupted
      }, 5000);

      img.onload = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(imageUrl);
        // Check if dimensions are valid
        resolve(img.naturalWidth === 0 || img.naturalHeight === 0);
      };

      img.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(imageUrl);
        resolve(true); // Error means corrupted
      };

      img.src = imageUrl;
    });

    return isCorrupted;
  } catch (error) {
    console.warn(`Error checking corruption for ${file.name}:`, error);
    return true; // If we can't check, assume corrupted
  }
};

/**
 * Extract EXIF data from an image file
 */
const extractExifData = async (file: File): Promise<any> => {
  try {
    if (!file.type.startsWith('image/')) {
      return undefined;
    }

    const exif = await exifr.parse(file, {
      pick: [
        'Make', 'Model', 'LensModel',
        'Artist', 'Copyright', 'Software',
        'ISO',
        'ExposureTime', 'FNumber', 'FocalLength',
        'DateTimeOriginal',
        'Orientation',
        'GPSLatitude', 'GPSLongitude', 'GPSAltitude',
        'WhiteBalance', 'Flash', 'ExposureMode', 'MeteringMode', 'ColorSpace'
      ]
    });

    if (!exif) return undefined;

    // Map exifr output to our ExifData type
    const exifData: any = {};

    if (exif.Make) exifData.cameraMake = exif.Make;
    if (exif.Model) exifData.cameraModel = exif.Model;
    if (exif.LensModel) exifData.lensModel = exif.LensModel;

    if (exif.Artist) exifData.artist = exif.Artist;
    if (exif.Copyright) exifData.copyright = exif.Copyright;
    if (exif.Software) exifData.software = exif.Software;

    if (exif.ISO) exifData.iso = exif.ISO;

    // Convert exposure time to shutter speed format
    if (exif.ExposureTime) {
      if (exif.ExposureTime < 1) {
        exifData.shutterSpeed = `1/${Math.round(1 / exif.ExposureTime)}`;
      } else {
        exifData.shutterSpeed = `${exif.ExposureTime}s`;
      }
    }

    // Convert F-number to aperture format
    if (exif.FNumber) {
      exifData.aperture = `f/${exif.FNumber}`;
    }

    // Convert focal length to string format
    if (exif.FocalLength) {
      exifData.focalLength = `${exif.FocalLength}mm`;
    }

    // Convert DateTimeOriginal to ISO 8601
    if (exif.DateTimeOriginal) {
      exifData.dateTaken = new Date(exif.DateTimeOriginal).toISOString();
    }

    if (exif.Orientation) exifData.orientation = exif.Orientation;

    // GPS coordinates
    if (exif.GPSLatitude !== undefined) exifData.gpsLatitude = String(exif.GPSLatitude);
    if (exif.GPSLongitude !== undefined) exifData.gpsLongitude = String(exif.GPSLongitude);
    if (exif.GPSAltitude !== undefined) exifData.gpsAltitude = String(exif.GPSAltitude);

    // Additional metadata in extra field
    const extra: any = {};
    if (exif.WhiteBalance !== undefined) extra.whiteBalance = exif.WhiteBalance;
    if (exif.Flash !== undefined) extra.flash = exif.Flash;
    if (exif.ExposureMode !== undefined) extra.exposureMode = exif.ExposureMode;
    if (exif.MeteringMode !== undefined) extra.meteringMode = exif.MeteringMode;
    if (exif.ColorSpace !== undefined) extra.colorSpace = exif.ColorSpace;

    if (Object.keys(extra).length > 0) {
      exifData.extra = extra;
    }

    return Object.keys(exifData).length > 0 ? exifData : undefined;
  } catch (error) {
    console.warn(`Failed to extract EXIF data from ${file.name}:`, error);
    return undefined;
  }
};

const fileToMockImage = (file: FileWithPreview): Image => ({
  id: 0,
  uuid: file.preview,
  filename: file.name,
  fileSize: file.size,
  format: normalizeFormatFromMimeType(file.type),
  width: 0,
  height: 0,
  hash: '',
  mimeType: file.type,
  isCorrupted: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
});

// Define columns for the file list table
const createColumns = (
  removeFile: (fileName: string) => void,
  uploadStatuses: Map<string, UploadStatus>
): ColumnDef<FileWithPreview>[] => [
    {
      accessorKey: 'preview',
      header: 'Preview',
      cell: ({ row }) => {
        const file = row.original;
        const isImage = file.type.startsWith('image/');
        const isTiff = file.type === 'image/tiff' || file.type === 'image/tif' ||
                       file.name.toLowerCase().endsWith('.tiff') ||
                       file.name.toLowerCase().endsWith('.tif');

        return (
          <div
            className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-50 bg-muted flex items-center justify-center"
          >
            {isTiff ? (
              <ImageIcon className="h-6 w-6 text-blue-500" />
            ) : isImage ? (
              <img
                src={file.preview}
                alt={file.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <FileText className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="hover:bg-transparent p-0 cursor-pointer"
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        return (
          <div className="font-medium truncate max-w-[200px]">
            {row.getValue('name')}
          </div>
        );
      },
      meta: {
        className: 'hidden sm:table-cell',
      },
    },
    {
      accessorKey: 'size',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="hover:bg-transparent p-0 cursor-pointer"
          >
            Size
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const size = row.getValue('size') as number;
        return (
          <div className="text-sm text-muted-foreground">
            {(size / 1024).toFixed(1)} KB
          </div>
        );
      },
      meta: {
        className: 'hidden md:table-cell',
      },
    },
    {
      accessorKey: 'sourcePath',
      header: 'Source Path',
      cell: ({ row }) => {
        const path = row.getValue('sourcePath') as string | undefined;
        return (
          <div className="text-sm text-muted-foreground truncate max-w-[300px]">
            {path || 'No path'}
          </div>
        );
      },
      meta: {
        className: 'hidden lg:table-cell',
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const file = row.original;
        const status = uploadStatuses.get(file.name);

        if (!status) return null;

        return (
          <div className="text-sm">
            {status.status === 'staged' && (
              <div className="flex flex-col gap-1">
                <span className="text-gray-400">Staged</span>
                {status.isCorrupted && (
                  <span className="text-xs text-red-500">⚠ Corrupted</span>
                )}
              </div>
            )}
            {status.status === 'pending' && (
              <div className="flex flex-col gap-1">
                <span className="text-gray-500">Pending</span>
                {status.isCorrupted && (
                  <span className="text-xs text-red-500">⚠ Corrupted</span>
                )}
              </div>
            )}
            {status.status === 'uploading' && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">{status.progress}%</span>
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${status.progress}%` }}
                    />
                  </div>
                </div>
                {status.isCorrupted && (
                  <span className="text-xs text-red-500">⚠ Corrupted</span>
                )}
              </div>
            )}
            {status.status === 'completed' && (
              <div className="flex flex-col gap-1">
                <span className="text-green-600">Completed</span>
                {status.isCorrupted && (
                  <span className="text-xs text-orange-500">⚠ Was Corrupted</span>
                )}
              </div>
            )}
            {status.status === 'failed' && (
              <div className="flex flex-col gap-1">
                <span className="text-red-600" title={status.error}>Failed</span>
                {status.isCorrupted && (
                  <span className="text-xs text-red-500">⚠ Corrupted</span>
                )}
              </div>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const file = row.original;
        const status = uploadStatuses.get(file.name);
        const isUploading = status?.status === 'uploading';

        return (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive cursor-pointer"
            onClick={() => removeFile(file.name)}
            disabled={isUploading}
          >
            <X className="h-4 w-4" />
          </Button>
        );
      },
      enableSorting: false,
    },
  ];


const FileListV2: React.FC<WithDropzoneProps> = ({ files, removeFile }) => {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [uploadStatuses, setUploadStatuses] = React.useState<Map<string, UploadStatus>>(new Map());
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadStats, setUploadStats] = React.useState<UploadStatistics>({
    totalFiles: 0,
    totalSize: 0,
    corruptedCount: 0,
  });

  // FIX 1: Use useRef instead of useState for tracking file count.
  // This prevents re-renders when we just want to update the counter.
  const previousFileCountRef = React.useRef(0);

  const { sourceMode } = useSettingsStore();
  const { triggerRefresh } = useGalleryRefreshStore();

  const allFilesCompleted = React.useMemo(() => {
    if (files.length === 0) return false;

    return files.every(file => {
      const status = uploadStatuses.get(file.name);
      return status?.status === 'completed';
    });
  }, [files, uploadStatuses]);

  // FIX 2: Functional state update for initialization.
  // We removed 'uploadStatuses' from the dependency array to break the update cycle.
  // This now only runs when the 'files' array actually changes.
  React.useEffect(() => {
    setUploadStatuses((prev) => {
      const newStatuses = new Map(prev);
      let hasChanges = false;

      files.forEach((file) => {
        if (!newStatuses.has(file.name)) {
          newStatuses.set(file.name, {
            fileName: file.name,
            progress: 0,
            status: 'staged',
          });
          hasChanges = true;
        }
      });

      return hasChanges ? newStatuses : prev;
    });
  }, [files]);

  // FIX 3: Robust cleanup logic using the Ref.
  React.useEffect(() => {
    const prevCount = previousFileCountRef.current;

    if (files.length > prevCount && uploadStatuses.size > 0) {
      // New files were added - remove old completed/failed files
      const completedOrFailedFiles: string[] = [];

      uploadStatuses.forEach((status, fileName) => {
        if (status.status === 'completed' || status.status === 'failed') {
          completedOrFailedFiles.push(fileName);
        }
      });

      // Remove completed/failed files
      completedOrFailedFiles.forEach((fileName) => {
        removeFile(fileName);
      });

      // Clear statuses
      setUploadStatuses(new Map());
    }

    // Update the ref without triggering a re-render
    previousFileCountRef.current = files.length;
  }, [files.length, uploadStatuses, removeFile]);


  // Update the columns memo:
  const columns = React.useMemo(
    () => createColumns(removeFile, uploadStatuses),
    [removeFile, uploadStatuses]
  );


  const table = useReactTable({
    data: files,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });


  /**
   * Handle form submission - upload all files
   */
  const handleSubmit = async () => {
    if (files.length === 0) return;

    setIsUploading(true);

    // Track results directly instead of relying on state
    let completedCount = 0;
    let failedCount = 0;

    try {
      // Check source mode
      if (sourceMode === 'local') {
        // LOCAL MODE: Save to local database only
        console.log('[Upload] Local mode: saving to local database');

        // Calculate total size
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);

        // Initialize upload status for all files
        const initialStatuses = new Map<string, UploadStatus>();
        files.forEach((file) => {
          initialStatuses.set(file.name, {
            fileName: file.name,
            progress: 0,
            status: 'pending',
          });
        });
        setUploadStatuses(initialStatuses);

        // Initialize statistics
        setUploadStats({
          totalFiles: files.length,
          totalSize: totalSize,
          corruptedCount: 0,
        });

        // Process each file
        for (const file of files) {
          try {
            // Check for corruption first
            const isCorrupted = await checkImageCorruption(file);

            // Update status to uploading
            setUploadStatuses((prev) => {
              const newMap = new Map(prev);
              newMap.set(file.name, {
                fileName: file.name,
                progress: 20,
                status: 'uploading',
                isCorrupted: isCorrupted,
              });
              return newMap;
            });

            // Update corruption count if needed
            if (isCorrupted) {
              setUploadStats((prev) => ({
                ...prev,
                corruptedCount: prev.corruptedCount + 1,
              }));
            }

            // Generate UUID for this image
            const uuid = uuidv4();
            // Use sourcePath for more reliable format detection (MIME type can be unreliable for TIFF)
            const format = file.sourcePath
              ? normalizeFormatFromFilename(file.sourcePath)
              : normalizeFormatFromMimeType(file.type);

            // Save file to AppData with UUID-based name (if has source path)
            if (file.sourcePath) {
              const result = await window.electronAPI?.saveFilesToLocal([{
                sourcePath: file.sourcePath,
                uuid,
                format,
              }]);
              if (!result?.success || !result.savedFiles || result.savedFiles.length === 0) {
                throw new Error('Failed to save file to local storage');
              }
            } else {
              // File doesn't have source path (e.g., from drag-drop of blob)
              console.warn(`File ${file.name} has no source path, skipping local save`);
              throw new Error('No source path available');
            }

            // Update progress - file saved
            setUploadStatuses((prev) => {
              const newMap = new Map(prev);
              newMap.set(file.name, {
                fileName: file.name,
                progress: 50,
                status: 'uploading',
              });
              return newMap;
            });

            // Generate thumbnail and extract dimensions
            let imageWidth = 0;
            let imageHeight = 0;
            let pageCount = 1;
            let tiffDimensions: Array<{ width: number; height: number }> | undefined = undefined;

            const isTiff = format === 'tiff';

            if (file.sourcePath && file.type.startsWith('image/')) {
              try {
                const thumbnailResult = await generateThumbnail(file.sourcePath, uuid, 300);
                if (thumbnailResult.success) {
                  console.log(`[Upload] Generated thumbnail for ${file.name}`);
                } else {
                  console.warn(`[Upload] Failed to generate thumbnail for ${file.name}:`, thumbnailResult.error);
                }
              } catch (error) {
                console.error(`[Upload] Thumbnail generation error for ${file.name}:`, error);
              }

              // For TIFF files, extract multi-page metadata
              if (isTiff && file.sourcePath && window.electronAPI?.getImgMetadata) {
                try {
                  const tiffMetadata = await window.electronAPI.getImgMetadata(file.sourcePath);
                  if (tiffMetadata.success) {
                    pageCount = tiffMetadata.pageCount || 1;
                    tiffDimensions = tiffMetadata.pages || [];
                    // For TIFF, leave width and height as 0 (will use tiffDimensions instead)
                    console.log(`[Upload] TIFF has ${pageCount} page(s)`);
                  }
                } catch (error) {
                  console.error(`[Upload] Failed to extract TIFF metadata for ${file.name}:`, error);
                }
              } else if (!isTiff && file.sourcePath) {
                // For non-TIFF images, get dimensions from Sharp metadata
                try {
                  const metadata = await window.electronAPI?.getImgMetadata?.(file.sourcePath);
                  if (metadata?.success && metadata.pages?.[0]) {
                    imageWidth = metadata.pages[0].width || 0;
                    imageHeight = metadata.pages[0].height || 0;
                  }
                } catch (error) {
                  // Fallback: dimensions will be 0
                  console.warn(`[Upload] Could not extract dimensions for ${file.name}`);
                }
              }
            }

            // Update progress - thumbnail generated
            setUploadStatuses((prev) => {
              const newMap = new Map(prev);
              newMap.set(file.name, {
                fileName: file.name,
                progress: 80,
                status: 'uploading',
              });
              return newMap;
            });

            // Extract EXIF data from the file
            const exifData = await extractExifData(file);

            // Calculate file hash
            let fileHash = '';
            if (file.sourcePath && window.electronAPI?.calculateFileHash) {
              try {
                const hashResult = await window.electronAPI.calculateFileHash(file.sourcePath);
                if (hashResult.success && hashResult.hash) {
                  fileHash = hashResult.hash;
                  console.log(`[Upload] Calculated hash for ${file.name}: ${fileHash.substring(0, 16)}...`);
                }
              } catch (error) {
                console.error(`[Upload] Failed to calculate hash for ${file.name}:`, error);
              }
            }

            // Create LocalImage record
            const localImage: LocalImage = {
              uuid,
              filename: file.name,
              fileSize: file.size,
              format,
              width: imageWidth,
              height: imageHeight,
              hash: fileHash,
              mimeType: file.type,
              isCorrupted: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              deletedAt: null,
              exifData: exifData,
              pageCount,
              tiffDimensions,
            };

            // Save to local database
            await localImageService.addImage(localImage);

            // Mark as completed
            completedCount++;
            setUploadStatuses((prev) => {
              const newMap = new Map(prev);
              newMap.set(file.name, {
                fileName: file.name,
                progress: 100,
                status: 'completed',
              });
              return newMap;
            });
          } catch (error) {
            console.error(`Failed to save ${file.name} to local:`, error);
            failedCount++;
            setUploadStatuses((prev) => {
              const newMap = new Map(prev);
              newMap.set(file.name, {
                fileName: file.name,
                progress: 0,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Upload failed',
              });
              return newMap;
            });
          }
        }

        // Show summary
        const corruptedInCompleted = uploadStats.corruptedCount;
        let summaryMessage = `Local upload complete!\n✓ ${completedCount} files saved`;
        if (failedCount > 0) {
          summaryMessage += `\n✗ ${failedCount} files failed`;
        }
        if (corruptedInCompleted > 0) {
          summaryMessage += `\n⚠ ${corruptedInCompleted} corrupted image(s) detected`;
        }
        alert(summaryMessage);

        // Trigger gallery refresh
        triggerRefresh();

        setIsUploading(false);
        return;
      }

    




      // Calculate total size for cloud upload
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      // Initialize upload status for all files
      const initialStatuses = new Map<string, UploadStatus>();
      files.forEach((file) => {
        initialStatuses.set(file.name, {
          fileName: file.name,
          progress: 0,
          status: 'pending',
        });
      });
      setUploadStatuses(initialStatuses);

      // Initialize statistics for cloud upload
      setUploadStats({
        totalFiles: files.length,
        totalSize: totalSize,
        corruptedCount: 0,
      });

      // STEP 1: Generate UUIDs, calculate hashes, dimensions, extract EXIF, and request presigned URLs
      const fileMetadata = await Promise.all(files.map(async (file) => {
        const uuid = uuidv4();
        // Use sourcePath for more reliable format detection (MIME type can be unreliable for TIFF)
        const format = file.sourcePath
          ? normalizeFormatFromFilename(file.sourcePath)
          : normalizeFormatFromMimeType(file.type);
        const isTiff = format === 'tiff';

        // Calculate hash - REQUIRED for cloud upload
        let hash = '';
        if (!file.sourcePath) {
          throw new Error(`File ${file.name} has no source path - cannot calculate hash`);
        }

        if (!window.electronAPI?.calculateFileHash) {
          throw new Error('Electron API not available for hash calculation');
        }

        const hashResult = await window.electronAPI.calculateFileHash(file.sourcePath);
        if (!hashResult.success || !hashResult.hash) {
          throw new Error(`Failed to calculate hash for ${file.name}: ${hashResult.error || 'Unknown error'}`);
        }

        hash = hashResult.hash;

        // Calculate width and height for image files
        let width = 0;
        let height = 0;
        let pageCount = 1;
        let tiffDimensions: Array<{ width: number; height: number }> | undefined = undefined;

        if (file.type.startsWith('image/')) {
          // For TIFF files, extract multi-page metadata using Electron API
          if (isTiff && file.sourcePath && window.electronAPI?.getImgMetadata) {
            try {
              const tiffMetadata = await window.electronAPI.getImgMetadata(file.sourcePath);
              if (tiffMetadata.success) {
                pageCount = tiffMetadata.pageCount || 1;
                tiffDimensions = tiffMetadata.pages || [];
                // For TIFF, leave width and height as 0 (will use tiffDimensions instead)
                console.log(`[Cloud Upload] TIFF has ${pageCount} page(s)`);
              }
            } catch (error) {
              console.error(`[Cloud Upload] Failed to extract TIFF metadata for ${file.name}:`, error);
            }
          } else if (!isTiff) {
            // For non-TIFF images, use the browser Image API
            try {
              const imageUrl = URL.createObjectURL(file);
              const img = new Image();

              await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                  width = img.naturalWidth;
                  height = img.naturalHeight;
                  URL.revokeObjectURL(imageUrl);
                  resolve();
                };
                img.onerror = () => {
                  URL.revokeObjectURL(imageUrl);
                  reject(new Error('Failed to load image'));
                };
                img.src = imageUrl;
              });
            } catch (error) {
              console.warn(`Failed to get dimensions for ${file.name}:`, error);
              // Continue with 0x0 dimensions if we can't read them
            }
          }
        }

        // Extract EXIF data
        const exifData = await extractExifData(file);

        return {
          file,
          uuid,
          filename: file.name,
          fileSize: file.size,
          format,
          mimeType: file.type,
          hash,
          width,
          height,
          exifData,
          pageCount,
          tiffDimensions,
        };
      }));

      const presignedURLs = await requestPresignedURLs(fileMetadata.map(meta => ({
        uuid: meta.uuid,
        filename: meta.filename,
        fileSize: meta.fileSize,
        format: meta.format,
        width: meta.width,
        height: meta.height,
        hash: meta.hash,
        mimeType: meta.mimeType,
        isCorrupted: false,
        exifData: meta.exifData,
        pageCount: meta.pageCount,
        tiffDimensions: meta.tiffDimensions,
        createdAt:new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null
      })))
      files.forEach((file) => {
        setUploadStatuses((prev) => {
          const newMap = new Map(prev);
          newMap.set(file.name, {
            fileName: file.name,
            progress: 30,
            status: 'uploading',
          });
          return newMap;
        });
      })



      const presignedURLMap = new Map<string, { imageUrl: string, thumbnailUrl: string }>();

      for (const url of presignedURLs) {
        presignedURLMap.set(url.uuid, {
          imageUrl: url.imageUrl,
          thumbnailUrl: url.thumbnailUrl,
        });
      }
     
      // STEP 2: Upload thumbnails first, then images
      for (const meta of fileMetadata) {
        const file = meta.file;
        try {
          // Check for corruption
          const isCorrupted = await checkImageCorruption(file);
          if (isCorrupted) {
            setUploadStats((prev) => ({
              ...prev,
              corruptedCount: prev.corruptedCount + 1,
            }));
            setUploadStatuses((prev) => {
              const newMap = new Map(prev);
              const current = newMap.get(file.name);
              if (current) {
                newMap.set(file.name, {
                  ...current,
                  isCorrupted: true,
                });
              }
              return newMap;
            });
          }

          const urls = presignedURLMap.get(meta.uuid);
          if (!urls) {
            throw new Error('No presigned URLs found for file');
          }

          // Generate and upload thumbnail FIRST for image files
          if (file.type.startsWith('image/')) {
            // Update progress - generating thumbnail
            setUploadStatuses((prev) => {
              const newMap = new Map(prev);
              newMap.set(file.name, {
                fileName: file.name,
                progress: 40,
                status: "uploading",
              });
              return newMap;
            });

            // Generate thumbnail blob
            let thumbnailBlob: Blob;

            // For TIFF files, we need to use Electron API since browser can't render TIFF
            if (meta.format === 'tiff' && file.sourcePath && window.electronAPI?.generateThumbnail) {
              try {
                // Get the first page of the TIFF as a buffer
                const result = await window.electronAPI.generateThumbnail(file.sourcePath, meta.uuid);

                if (!result.success || !result.imageBuffer) {
                  throw new Error('Failed to generate TIFF thumbnail');
                }

                // Convert the buffer to a Blob that can be used with canvas
                const imageBuffer = new Uint8Array(result.imageBuffer);
                const tempBlob = new Blob([imageBuffer]);

                // Use generateThumbnailBlob with the converted buffer
                thumbnailBlob = await generateThumbnailBlob(tempBlob, 300);
              } catch (error) {
                console.error(`[Cloud Upload] TIFF thumbnail generation failed for ${file.name}:`, error);
                throw new Error(`Failed to generate TIFF thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            } else {
              // For non-TIFF images, use the standard browser-based method
              thumbnailBlob = await generateThumbnailBlob(file, 300);
            }

            // Update progress - uploading thumbnail
            setUploadStatuses((prev) => {
              const newMap = new Map(prev);
              newMap.set(file.name, {
                fileName: file.name,
                progress: 50,
                status: "uploading",
              });
              return newMap;
            });

            // Upload thumbnail to presigned URL - ABORT if this fails
            const thumbnailSuccess = await uploadToPresignedURL(urls.thumbnailUrl, thumbnailBlob, true);

            if (!thumbnailSuccess) {
              throw new Error('Failed to upload thumbnail');
            }

            // Update progress after thumbnail upload
            setUploadStatuses((prev) => {
              const newMap = new Map(prev);
              newMap.set(file.name, {
                fileName: file.name,
                progress: 60,
                status: "uploading",
              });
              return newMap;
            });
          }

          // Now upload the image (only if thumbnail succeeded)
          const imageSuccess = await uploadToPresignedURL(urls.imageUrl, file);

          if (!imageSuccess) {
            throw new Error('Failed to upload image');
          }

          // Update progress after image upload
          setUploadStatuses((prev) => {
            const newMap = new Map(prev);
            newMap.set(file.name, {
              fileName: file.name,
              progress: 90,
              status: "uploading",
            });
            return newMap;
          });

          // Mark as completed
          completedCount++;
          setUploadStatuses((prev) => {
            const newMap = new Map(prev);
            newMap.set(file.name, {
              fileName: file.name,
              progress: 100,
              status: 'completed',
            });
            return newMap;
          });

        } catch (error) {
          console.error(`Upload failed for ${file.name}:`, error);
          failedCount++;
          setUploadStatuses((prev) => {
            const newMap = new Map(prev);
            newMap.set(file.name, {
              fileName: file.name,
              progress: 0,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Upload failed',
            });
            return newMap;
          });
        }
      }






      // Show completion message using tracked counts
      const corruptedInCompleted = uploadStats.corruptedCount;
      if (failedCount === 0) {
        let message = `Successfully uploaded ${completedCount} file(s)!`;
        if (corruptedInCompleted > 0) {
          message += `\n⚠ ${corruptedInCompleted} corrupted image(s) detected`;
        }
        alert(message);
        // Don't clear files or statuses - let them see the completion status
      } else {
        let message = `Upload completed with ${completedCount} success(es) and ${failedCount} failure(s).`;
        if (corruptedInCompleted > 0) {
          message += `\n⚠ ${corruptedInCompleted} corrupted image(s) detected`;
        }
        alert(message);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('An error occurred during upload. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="rounded-xl bg-white p-2 border-2 border-slate-200 h-full flex flex-col dark:border-gray-600 dark:bg-gray-700">
      {/* Upload Statistics Section */}
      {uploadStats.totalFiles > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-3 dark:from-blue-950/40 dark:to-indigo-950/40 dark:border-gray-600">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 dark:text-gray-200">Upload Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-md p-3 border border-blue-100 dark:bg-gray-600 dark:border-gray-500">
              <div className="text-xs text-gray-500 mb-1 dark:text-gray-300">Total Files</div>
              <div className="text-2xl font-bold text-blue-600">{uploadStats.totalFiles}</div>
            </div>
            <div className="bg-white rounded-md p-3 border border-blue-100 dark:bg-gray-600 dark:border-gray-500">
              <div className="text-xs text-gray-500 mb-1 dark:text-gray-300">Total Size</div>
              <div className="text-2xl font-bold text-green-600">{formatFileSize(uploadStats.totalSize)}</div>
            </div>
            <div className="bg-white rounded-md p-3 border border-blue-100 dark:bg-gray-600 dark:border-gray-500">
              <div className="text-xs text-gray-500 mb-1 dark:text-gray-300">Corrupted Images</div>
              <div className={`text-2xl font-bold ${uploadStats.corruptedCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {uploadStats.corruptedCount}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto dark:bg-gray-800 dark:text-gray-400">
        <Table>
          <TableHeader className="sticky top-0 bg-white z-10 border-b border-slate-50 dark:bg-gray-700 dark:text-gray-300">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className={(header.column.columnDef.meta as any)?.className}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={(cell.column.columnDef.meta as any)?.className}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No files.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Sticky Footer with Clear and Submit Buttons */}
      <div className="bg-white border-t border-gray-300 p-4 flex gap-3 items-center dark:bg-gray-700">
        <Button
          className={"text-white cursor-pointer " + (files.length === 0 || isUploading ? "bg-red-200 dark:bg-red-300" : "bg-red-600 hover:bg-red-500 dark:bg-red-900 dark:hover:bg-red-800 dark:text-gray-300")}
          disabled={files.length === 0 || isUploading}
          onClick={() => {
            // Skip confirmation if all files are completed
            if (!allFilesCompleted) {
              const confirmed = window.confirm(
                `Are you sure you want to clear all ${files.length} file${files.length !== 1 ? 's' : ''}?`
              );
              if (!confirmed) return;
            }

            files.forEach(file => removeFile(file.name));
            setUploadStatuses(new Map());
            // Reset statistics when clearing files
            setUploadStats({
              totalFiles: 0,
              totalSize: 0,
              corruptedCount: 0,
            });
          }}
        >
          Clear All
        </Button>
        <Button
          className={"flex-1 cursor-pointer text-white " + (files.length === 0 || isUploading ? "bg-blue-100 dark:bg-blue-200" : "bg-blue-600 hover:bg-blue-500 dark:bg-blue-800 dark:hover:bg-blue-700 dark:text-gray-300")}
          disabled={files.length === 0 || isUploading || allFilesCompleted}
          onClick={handleSubmit}
        >
          {isUploading ? 'Uploading...' : `Submit ${files.length > 0 ? `(${files.length} files)` : ''}`}
        </Button>

      </div>
    </div>
  );
};

export default withDropzone(FileListV2, { recursive: true });