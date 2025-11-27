import React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { X, FileText, ArrowUpDown } from 'lucide-react';
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
import { useImageViewerStore } from '@/stores/imageViewerStore';
import type { Image } from '@/types/api';
import { useSettingsStore } from '@/stores/settingsStore';
import { localImageService } from '@/services/localImage.service';
import { LocalImage } from '@/types/local';
import { useGalleryRefreshStore } from '@/stores/galleryRefreshStore';
import { generateThumbnail, generateThumbnailBlob } from '@/utils/thumbnailGenerator';
import { v4 as uuidv4 } from 'uuid';

// Upload configuration
const SIZE_THRESHOLD = 50 * 1024 * 1024; // 50MB in bytes
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Upload status tracking
interface UploadStatus {
  fileName: string;
  progress: number;
  status: 'staged' | 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
}

const fileToMockImage = (file: FileWithPreview): Image => ({
  id: 0,
  uuid: file.preview,
  filename: file.name,
  fileSize: file.size,
  format: (file.type.split('/')[1] as 'jpg' | 'jpeg' | 'png' | 'tif' | 'tiff') || 'jpg',
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
  uploadStatuses: Map<string, UploadStatus>,
  onThumbnailClick: (file: FileWithPreview, index: number) => void,
  files: FileWithPreview[]
): ColumnDef<FileWithPreview>[] => [
    {
      accessorKey: 'preview',
      header: 'Preview',
      cell: ({ row }) => {
        const file = row.original;
        const isImage = file.type.startsWith('image/');
        const fileIndex = files.findIndex(f => f.name === file.name);

        return (
          <div
            className={`h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-50 bg-muted flex items-center justify-center ${isImage ? 'cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all' : ''}`}
            onClick={() => isImage && onThumbnailClick(file, fileIndex)}
          >
            {isImage ? (
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
              <span className="text-gray-400">Staged</span>
            )}
            {status.status === 'pending' && (
              <span className="text-gray-500">Pending</span>
            )}
            {status.status === 'uploading' && (
              <div className="flex items-center gap-2">
                <span className="text-blue-600">{status.progress}%</span>
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
              </div>
            )}
            {status.status === 'completed' && (
              <span className="text-green-600">Completed</span>
            )}
            {status.status === 'failed' && (
              <span className="text-red-600" title={status.error}>Failed</span>
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

  // FIX 1: Use useRef instead of useState for tracking file count.
  // This prevents re-renders when we just want to update the counter.
  const previousFileCountRef = React.useRef(0);

  const { openViewer } = useImageViewerStore();
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


  const handleThumbnailClick = (file: FileWithPreview, index: number) => {
    // Only allow viewing images
    if (!file.type.startsWith('image/')) return;

    // Convert all image files to mock image objects
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const mockImages = imageFiles.map(fileToMockImage);
    const imageIndex = imageFiles.findIndex(f => f.name === file.name);

    // Open viewer in readonly mode (3rd parameter = true)
    openViewer(mockImages[imageIndex], mockImages, true);
  };

  // Update the columns memo to include the handler and files:
  const columns = React.useMemo(
    () => createColumns(removeFile, uploadStatuses, handleThumbnailClick, files),
    [removeFile, uploadStatuses, files]
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
   * Upload a single file using chunked upload
   */
  // const uploadFileChunked = async (file: File): Promise<void> => {
  //   const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  //   // Initialize upload session
  //   const session = await initChunkedUpload({
  //     filename: file.name,
  //     totalSize: file.size,
  //     chunkSize: CHUNK_SIZE,
  //     totalChunks,
  //     mimeType: file.type,
  //   });

  //   // Upload chunks
  //   for (let chunkNumber = 0; chunkNumber < totalChunks; chunkNumber++) {
  //     const start = chunkNumber * CHUNK_SIZE;
  //     const end = Math.min(start + CHUNK_SIZE, file.size);
  //     const chunk = file.slice(start, end);

  //     await uploadChunk(session.sessionId, chunk, chunkNumber);

  //     // Update progress
  //     const progress = Math.round(((chunkNumber + 1) / totalChunks) * 100);
  //     setUploadStatuses((prev) => {
  //       const newMap = new Map(prev);
  //       newMap.set(file.name, {
  //         fileName: file.name,
  //         progress,
  //         status: 'uploading',
  //       });
  //       return newMap;
  //     });
  //   }

  //   // Complete the upload
  //   await completeChunkedUpload(session.sessionId);
  // };

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

        // Process each file
        for (const file of files) {
          try {
            // Update status to uploading
            setUploadStatuses((prev) => {
              const newMap = new Map(prev);
              newMap.set(file.name, {
                fileName: file.name,
                progress: 20,
                status: 'uploading',
              });
              return newMap;
            });

            // Generate UUID for this image
            const uuid = uuidv4();
            const format = (file.type.split('/')[1] as any) || 'jpg';

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

            // Generate thumbnail
            let imageWidth = 0;
            let imageHeight = 0;

            if (file.sourcePath && file.type.startsWith('image/')) {
              try {
                const thumbnailResult = await generateThumbnail(file.sourcePath, uuid, 300);
                if (thumbnailResult.success) {
                  imageWidth = thumbnailResult.width || 0;
                  imageHeight = thumbnailResult.height || 0;
                  console.log(`[Upload] Generated thumbnail for ${file.name}`);
                } else {
                  console.warn(`[Upload] Failed to generate thumbnail for ${file.name}:`, thumbnailResult.error);
                }
              } catch (error) {
                console.error(`[Upload] Thumbnail generation error for ${file.name}:`, error);
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

            // Create LocalImage record
            const localImage: LocalImage = {
              uuid,
              filename: file.name,
              fileSize: file.size,
              format,
              width: imageWidth,
              height: imageHeight,
              hash: '',
              mimeType: file.type,
              isCorrupted: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              deletedAt: null,
              exifData: undefined,
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
        alert(`Local upload complete!\n✓ ${completedCount} files saved\n${failedCount > 0 ? `✗ ${failedCount} files failed` : ''}`);

        // Trigger gallery refresh
        triggerRefresh();

        setIsUploading(false);
        return;
      }

      // CLOUD MODE: Original logic




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

      // STEP 1: Generate UUIDs, calculate hashes, dimensions, and request presigned URLs
      const fileMetadata = await Promise.all(files.map(async (file) => {
        const uuid = uuidv4();
        const format = (file.type.split('/')[1] as 'jpg' | 'jpeg' | 'png' | 'tif' | 'tiff') || 'jpg';

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

        if (file.type.startsWith('image/')) {
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
            const thumbnailBlob = await generateThumbnailBlob(file, 300);

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
      if (failedCount === 0) {
        alert(`Successfully uploaded ${completedCount} file(s)!`);
        // Don't clear files or statuses - let them see the completion status
      } else {
        alert(
          `Upload completed with ${completedCount} success(es) and ${failedCount} failure(s).`
        );
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('An error occurred during upload. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="rounded-xl bg-white p-2 border-2 border-slate-200 h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-white z-10 border-b border-slate-50">
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
      <div className="bg-white border-t border-gray-300 p-4 flex gap-3 items-center">
        <Button
          className={"text-white cursor-pointer " + (files.length === 0 || isUploading ? "bg-red-200" : "bg-red-600 hover:bg-red-500")}
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
          }}
        >
          Clear All
        </Button>
        <Button
          className={"flex-1 cursor-pointer text-white " + (files.length === 0 || isUploading ? "bg-blue-100" : "bg-blue-600 hover:bg-blue-500")}
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