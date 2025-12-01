import React, { useCallback, useState, useEffect, ComponentType } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Loader2, FileWarning, FileImage } from 'lucide-react';
import { cn } from '@/lib/utils';

import { processBatchDrop, readFilesFromPaths } from '@/utils/batchProcessor';

const MAX_SIZE = 200 * 1024 * 1024;

export interface FileWithPreview extends File {
  preview: string;
  sourcePath?: string;
}

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

    const handleFiles = async (incomingFiles: File[]) => {
      setIsProcessing(true);
      setErrorMsg(null);

      try {
        const rawFiles = await processBatchDrop(incomingFiles, config.recursive);

        if (rawFiles.length === 0 && incomingFiles.length > 0) {
          setErrorMsg("No valid images found.");
        }

        const mappedFiles = rawFiles.map((file) => {
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

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
      await handleFiles(acceptedFiles);
    }, []);

    const openNativeDialog = async () => {
      if (isProcessing) return;

      const api = window.electronAPI;
      if (!api) return;

      try {
        const paths = await api.openDialog();

        if (paths && paths.length > 0) {
          setIsProcessing(true);

          const expandedArrays = await Promise.all(
            paths.map(path => api.expandPath(path, config.recursive))
          );

          const allFilePaths = expandedArrays.flat();

          const filesFromDialog = await readFilesFromPaths(allFilePaths);
          await handleFiles(filesFromDialog);
        }
      } catch (err) {
        console.error(err);
        setIsProcessing(false);
      }
    };

    const removeFile = useCallback((fileName: string) => {
      setFiles((prevFiles) => {
        const fileToRemove = prevFiles.find(f => f.name === fileName);
        if (fileToRemove) URL.revokeObjectURL(fileToRemove.preview);
        return prevFiles.filter((f) => f.name !== fileName);
      });
    }, []);


    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      multiple: true,
      maxSize: MAX_SIZE,
      useFsAccessApi: false,
      noClick: true,     // Disable HTML click
      noKeyboard: true   // Disable HTML keyboard interaction
    });

    useEffect(() => {
      return () => files.forEach((file) => URL.revokeObjectURL(file.preview));
    }, []);

    return (
      <div className="h-full w-full flex flex-col font-sans gap-4 ">
        <div
          {...getRootProps()}
          onClick={openNativeDialog} 
          className={cn(
            "relative border-2  border-dashed border-slate-300 hover:border-slate-400 rounded-lg p-10 transition-all duration-100 ease-in-out cursor-pointer flex flex-col items-center justify-center gap-4  bg-slate-100b dark:bg-gray-800 dark:border-gray-600",
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
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-500">Processing Selection...</p>
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
                        className="text-blue-600 font-medium hover:text-blue-700 cursor-pointer dark:text-blue-600 dark:hover:text-blue-500"
                      >
                        Click 
                        <span className='text-black px-1 dark:text-gray-300'>
                            or 
                        </span>
                        
                        Drag
                      </span>
                      <span className="text-gray-600 dark:text-gray-400"> to upload your file.</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
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
            removeFile={removeFile}
            isProcessing={isProcessing}
          />
        </div>
      </div>
    );
  };
}

export default withDropzone;