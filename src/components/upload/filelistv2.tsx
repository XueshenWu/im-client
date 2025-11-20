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
  uploadImages,
  initChunkedUpload,
  uploadChunk,
  completeChunkedUpload,
} from '@/services/images.service';

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
        return (
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-50 bg-muted flex items-center justify-center">
            {file.type.startsWith('image/') ? (
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
  const [previousFileCount, setPreviousFileCount] = React.useState(0);
  const [syncToCloud, setSyncToCloud] = React.useState(true);

  // Set staged status for new files that don't have a status yet
  React.useEffect(() => {
    const newStatuses = new Map(uploadStatuses);
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

    if (hasChanges) {
      setUploadStatuses(newStatuses);
    }
  }, [files, uploadStatuses]);

  // Clear completed/failed files when new files are added
  React.useEffect(() => {
    if (files.length > previousFileCount && uploadStatuses.size > 0) {
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
    setPreviousFileCount(files.length);
  }, [files.length, uploadStatuses, removeFile, previousFileCount]);

  const columns = React.useMemo(() => createColumns(removeFile, uploadStatuses), [removeFile, uploadStatuses]);

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
  const uploadFileChunked = async (file: File): Promise<void> => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Initialize upload session
    const session = await initChunkedUpload({
      filename: file.name,
      totalSize: file.size,
      chunkSize: CHUNK_SIZE,
      totalChunks,
      mimeType: file.type,
    });

    // Upload chunks
    for (let chunkNumber = 0; chunkNumber < totalChunks; chunkNumber++) {
      const start = chunkNumber * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      await uploadChunk(session.sessionId, chunk, chunkNumber);

      // Update progress
      const progress = Math.round(((chunkNumber + 1) / totalChunks) * 100);
      setUploadStatuses((prev) => {
        const newMap = new Map(prev);
        newMap.set(file.name, {
          fileName: file.name,
          progress,
          status: 'uploading',
        });
        return newMap;
      });
    }

    // Complete the upload
    await completeChunkedUpload(session.sessionId);
  };

  /**
   * Handle form submission - upload all files
   */
  const handleSubmit = async () => {
    if (files.length === 0) return;

    setIsUploading(true);

    // Track results directly instead of relying on state
    let completedCount = 0;
    let failedCount = 0;
    // FIXME: Need to upload to local after to cloud
    try {
      // STEP 1: Always save files with paths to local storage first
      const filesWithPaths = files.filter(file => file.sourcePath);
      const filesWithoutPaths = files.filter(file => !file.sourcePath);

      let localSavedCount = 0;

      // Save files to local storage if they have paths
      if (filesWithPaths.length > 0) {
        try {
          const filePaths = filesWithPaths.map(file => file.sourcePath!);
          const result = await window.electronAPI?.saveFilesToLocal(filePaths);

          if (result?.success) {
            localSavedCount = result.savedFiles?.length || 0;
          }
        } catch (error) {
          console.error('Failed to save to local storage:', error);
        }
      }



      // STEP 3: If syncing to cloud, continue with cloud upload
      // Separate files into small and large
      const smallFiles: File[] = [];

      const largeFiles: File[] = [];

      files.forEach((file) => {
        if (file.size < SIZE_THRESHOLD) {
          smallFiles.push(file);
        } else {
          largeFiles.push(file);
        }
      });

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

      // Upload small files using regular upload
      if (smallFiles.length > 0) {
        try {
          smallFiles.forEach((file) => {
            setUploadStatuses((prev) => {
              const newMap = new Map(prev);
              newMap.set(file.name, {
                fileName: file.name,
                progress: 50,
                status: 'uploading',
              });
              return newMap;
            });
          });

          await uploadImages(smallFiles);

          // Mark as completed and track count
          smallFiles.forEach((file) => {
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
          });
        } catch (error) {
          console.error('Regular upload failed:', error);
          smallFiles.forEach((file) => {
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
          });
        }
      }

      // Upload large files using chunked upload
      for (const file of largeFiles) {
        try {
          await uploadFileChunked(file);

          // Mark as completed and track count
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
          console.error(`Chunked upload failed for ${file.name}:`, error);
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
            const confirmed = window.confirm(
              `Are you sure you want to clear all ${files.length} file${files.length !== 1 ? 's' : ''}?`
            );
            if (confirmed) {
              files.forEach(file => removeFile(file.name));
              setUploadStatuses(new Map());
            }
          }}
        >
          Clear All
        </Button>
        <Button
          className={"flex-1 cursor-pointer text-white " + (files.length === 0 || isUploading ? "bg-blue-100" : "bg-blue-600 hover:bg-blue-500")}
          disabled={files.length === 0 || isUploading}
          onClick={handleSubmit}
        >
          {isUploading ? 'Uploading...' : `Submit ${files.length > 0 ? `(${files.length} files)` : ''}`}
        </Button>

      </div>
    </div>
  );
};

export default withDropzone(FileListV2, { recursive: true });
