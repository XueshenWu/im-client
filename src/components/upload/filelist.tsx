import React from 'react';
import withDropzone, { WithDropzoneProps } from '@/components/upload/dropzone';
import { X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FileListItemProps {
  file: File & { preview?: string; sourcePath?: string };
  onRemove: (fileName: string) => void;
}

const FileListItem: React.FC<FileListItemProps> = ({ file, onRemove }) => {
  return (
    <div
      className="flex items-center gap-4 p-3 rounded-lg border bg-card text-card-foreground shadow-sm group hover:bg-accent/50 transition-colors"
    >
      {/* Preview */}
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted flex items-center justify-center">
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

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
           {(file.size / 1024).toFixed(1)} KB • {file.sourcePath || "No path"}
        </p>
      </div>

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(file.name)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};


const FileList: React.FC<WithDropzoneProps> = ({ files, removeFile }) => {
  if (files.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">
          Attached Files ({files.length})
        </h4>
      </div>

      <ScrollArea className="h-[300px] w-full rounded-md border">
        <div className="p-4 space-y-4">
          {files.map((file, index) => (
            <FileListItem
              key={`${file.name}-${index}`}
              file={file}
              onRemove={removeFile}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default withDropzone(FileList);