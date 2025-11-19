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

// Define columns for the file list table
const createColumns = (
  removeFile: (fileName: string) => void
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
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      const file = row.original;
      return (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground hover:text-destructive cursor-pointer"
          onClick={() => removeFile(file.name)}
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

  const columns = React.useMemo(() => createColumns(removeFile), [removeFile]);

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
      <div className="bg-white border-t border-gray-300 p-4 flex gap-3">
        <Button
          className={"text-white cursor-pointer "+(files.length === 0? "bg-red-200":"bg-red-600 hover:bg-red-500")}
          disabled={files.length === 0}
          onClick={() => {
            const confirmed = window.confirm(
              `Are you sure you want to clear all ${files.length} file${files.length !== 1 ? 's' : ''}?`
            );
            if (confirmed) {
              files.forEach(file => removeFile(file.name));
            }
          }}
        >
          Clear All
        </Button>
        <Button className={"flex-1 cursor-pointer text-white "+(files.length ===0?"bg-blue-100":"bg-blue-600 hover:bg-blue-500")} disabled={files.length === 0}>
          Submit {files.length > 0 && `(${files.length} files)`}
        </Button>
      </div>
    </div>
  );
};

export default withDropzone(FileListV2);
