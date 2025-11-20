import React, { useCallback, useState, useEffect, ComponentType } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Loader2, FileWarning, FileImage } from 'lucide-react';
import { cn } from '@/lib/utils';
// Ensure readFilesFromPaths is exported from your utils file!
import { processBatchDrop, readFilesFromPaths } from '@/utils/batchProcessor';

// --- Configuration ---
const MAX_SIZE = 200 * 1024 * 1024;

// --- Types ---
export interface FileWithPreview extends File {
  preview: string;
  sourcePath?: string;
}

// Props injected BY the HOC into your component
export interface WithDropzoneProps {
  files: FileWithPreview[];
  removeFile: (fileName: string) => void;
  isProcessing: boolean;
}

export interface DropzoneConfig {
  recursive?: boolean;
}





function withDropzone<P extends WithDropzoneProps>(
  WrappedComponent: ComponentType<P>,
  config: DropzoneConfig = { recursive: false }
) {
  return (props: Omit<P, keyof WithDropzoneProps>) => {
    const [files, setFiles] = useState<FileWithPreview[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // --------------------------------------------
    // 1. HELPER: Common Processor
    // --------------------------------------------
    const handleFiles = async (incomingFiles: File[]) => {
      setIsProcessing(true);
      setErrorMsg(null);

      try {
        const rawFiles = await processBatchDrop(incomingFiles, config.recursive);

        if (rawFiles.length === 0 && incomingFiles.length > 0) {
          // Only show error if we actually had input but filtered everything out
          setErrorMsg("No valid images found.");
        }

        const mappedFiles = rawFiles.map((file) => {
          // Prioritize manual path (from batch processor) -> electron path -> null
          const manualPath = (file as any).sourcePath || (file as any).path;
          const electronPath = window.electronAPI?.getFilePath(file);
          const finalPath = manualPath || electronPath;

          return Object.assign(file, {
            preview: URL.createObjectURL(file),
            sourcePath: finalPath
          }) as FileWithPreview;
        });

        setFiles((prev) => {
          const newUnique = mappedFiles.filter(newFile =>
            !prev.some(existing =>
              (existing.sourcePath && existing.sourcePath === newFile.sourcePath) ||
              (existing.name === newFile.name && existing.size === newFile.size)
            )
          );
          return [...prev, ...newUnique];
        });

      } catch (error) {
        console.error("Processing failed", error);
        setErrorMsg("Failed to process selection.");
      } finally {
        setIsProcessing(false);
      }
    };

    // --------------------------------------------
    // 2. HANDLE DRAG
    // --------------------------------------------
    const onDrop = useCallback(async (acceptedFiles: File[]) => {
      await handleFiles(acceptedFiles);
    }, []);

    // --------------------------------------------
    // 3. HANDLE CLICK (Native Dialog)
    // --------------------------------------------
    // Inside components/withDropzone.tsx
    // --------------------------------------------
    // 3. HANDLE CLICK (Native Dialog)
    // --------------------------------------------
    const openNativeDialog = async () => {
      if (isProcessing) return;

      // 1. STRICT GUARD: Capture the API first.
      // This prevents TS errors inside the .map() callback below.
      const api = window.electronAPI;
      if (!api) return;

      try {
        const paths = await api.openDialog();

        if (paths && paths.length > 0) {
          setIsProcessing(true);

          // 2. Expand paths using the captured 'api' variable
          // Since 'api' is defined, expandPath returns Promise<string[]>, never undefined.
          const expandedArrays = await Promise.all(
            paths.map(path => api.expandPath(path, config.recursive))
          );

          // 3. Flatten: [[img1], [img2, img3]] -> [img1, img2, img3]
          // This is now strictly string[], which matches readFilesFromPaths.
          const allFilePaths = expandedArrays.flat();

          const filesFromDialog = await readFilesFromPaths(allFilePaths);
          await handleFiles(filesFromDialog);
        }
      } catch (err) {
        console.error(err);
        // Optional: setIsProcessing(false) here if not handled by handleFiles
        setIsProcessing(false);
      }
    };

    // --------------------------------------------
    // 4. REMOVE FILE
    // --------------------------------------------
    const removeFile = useCallback((fileName: string) => {
      setFiles((prevFiles) => {
        const fileToRemove = prevFiles.find(f => f.name === fileName);
        if (fileToRemove) URL.revokeObjectURL(fileToRemove.preview);
        return prevFiles.filter((f) => f.name !== fileName);
      });
    }, []);

    // --------------------------------------------
    // 5. SETUP DROPZONE
    // --------------------------------------------
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      multiple: true,
      maxSize: MAX_SIZE,
      useFsAccessApi: false,
      noClick: true,     // Disable HTML click
      noKeyboard: true   // Disable HTML keyboard interaction
      // No 'accept' prop: we accept everything and filter in handleFiles
    });

    // Cleanup on unmount
    useEffect(() => {
      return () => files.forEach((file) => URL.revokeObjectURL(file.preview));
    }, []);

    return (
      <div className="h-full w-full flex flex-col font-sans gap-4">
        <div
          {...getRootProps()}
          onClick={openNativeDialog} // Manual Click Handler
          className={cn(
            "relative border-2  border-dashed border-slate-300 hover:border-slate-400 rounded-lg p-10 transition-all duration-100 ease-in-out cursor-pointer flex flex-col items-center justify-center gap-4  bg-slate-100",
            "",
            isDragActive && "ring-2 ring-blue-300 border-0 hover:border-0",
            isProcessing && "opacity-60 pointer-events-none cursor-wait"
          )}
        >
          <input {...getInputProps()} />

          {isProcessing ? (
            <div className="flex flex-col items-center gap-3 animate-pulse">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700">Processing Selection...</p>
                <p className="text-xs text-gray-500">Reading files & scanning folders...</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              {/* Icon */}
              <div className={cn(
                "transition-all duration-200",
                isDragActive && "scale-110"
              )}>
                <FileImage className={cn(
                  "h-12 w-12",
                  isDragActive ? "text-blue-600" : "text-blue-500"
                )} />
              </div>

              {/* Text */}
              <div className="space-y-1">
                <p className="text-sm text-gray-700">
                  {isDragActive ? (
                    <span className="font-medium">Drop items now...</span>
                  ) : (
                    <>
                      <span
                        className="text-blue-600 font-medium hover:text-blue-700 cursor-pointer "
                      >
                        Click 
                        <span className='text-black px-1'>
                            or 
                        </span>
                        
                        Drag
                      </span>
                      <span className="text-gray-600"> to upload your file.</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  Supported Format: Images, ZIP, JSON, Folders (4K max)
                </p>
              </div>
            </div>
          )}

          {errorMsg && !isDragActive && !isProcessing && (
            <div className="absolute bottom-4 flex items-center gap-2 text-xs font-medium text-destructive bg-destructive/10 px-3 py-1.5 rounded-full">
              <FileWarning className="h-4 w-4" />
              {errorMsg}
            </div>
          )}
        </div>
        <div className="flex-1 min-h-0">
          <WrappedComponent
            {...(props as P)}
            files={files}
            removeFile={removeFile} // ✅ Pass the local function
            isProcessing={isProcessing}
          />
        </div>
      </div>
    );
  };
}

export default withDropzone;