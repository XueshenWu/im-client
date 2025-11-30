"use client"

import * as React from "react"
import { useTranslation } from 'react-i18next'
import { useImageViewerStore } from '@/stores/imageViewerStore'
import { useGalleryRefreshStore } from '@/stores/galleryRefreshStore'
import { localDatabase } from '@/services/localDatabase.service'
import { localImageService } from '@/services/localImage.service'
import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Download, Trash2, Eye, Edit, Copy } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"
import { ChevronDown, X, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react"

import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTiffImageViewerStore } from "@/stores/tiffImageViewerStore"
import { ImageWithSource } from "@/types/gallery"
import { useExifEditorStore } from "@/stores/exifEditorStore"
import { toast } from 'sonner'

// Helper function to format file size
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper component for sortable column headers
const SortableHeader = ({
  label,
  column,
  sortBy,
  sortOrder,
  onSort
}: {
  label: string;
  column: 'name' | 'size' | 'type' | 'updatedAt' | 'createdAt';
  sortBy: 'name' | 'size' | 'type' | 'updatedAt' | 'createdAt' | null;
  sortOrder: 'asc' | 'desc';
  onSort: (column: 'name' | 'size' | 'type' | 'updatedAt' | 'createdAt') => void;
}) => {
  const isActive = sortBy === column;
  const Icon = !isActive ? ArrowUpDown : sortOrder === 'asc' ? ArrowUp : ArrowDown;

  return (
    <Button
      variant="ghost"
      onClick={() => onSort(column)}
      className="hover:bg-transparent p-0"
    >
      {label}
      <Icon className={`ml-2 h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
    </Button>
  );
};



// Local Thumbnail component for local files (using UUID-based protocol)
const LocalThumbnail = ({ uuid }: { uuid: string }) => {
  return <img src={`local-thumbnail://${uuid}`} alt="thumbnail" className="h-14 w-14 rounded object-cover" />;
};


// Create columns for local detail list (similar to DetailList but with LocalThumbnail)
const createLocalColumns = (
  sortBy: 'name' | 'size' | 'type' | 'updatedAt' | 'createdAt' | null,
  sortOrder: 'asc' | 'desc',
  onSort: (column: 'name' | 'size' | 'type' | 'updatedAt' | 'createdAt') => void,
  t: (key: string) => string,
  onViewImage: (image: ImageWithSource) => void,
  onEditExif: (image: ImageWithSource) => void
): ColumnDef<ImageWithSource>[] => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="border-gray-300 bg-white rounded-md  hover:border-blue-300 duration-100 "
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="border-gray-300 rounded-md hover:border-blue-300 duration-100 "
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 60,
      minSize: 60,
      maxSize: 60,
    },
    {
      accessorKey: "uuid",
      header: () => t('table.preview'),
      cell: ({ row }) => {
        return <LocalThumbnail uuid={row.original.uuid} />;
      },
      enableSorting: false,
      size: 100,
      minSize: 60,
      maxSize: 100,
    },
    {
      accessorKey: "filename",
      header: () => (
        <SortableHeader
          label={t('table.name')}
          column="name"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => {
        const name = row.getValue("filename") as string;
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="font-medium truncate max-w-[300px]">{name}</div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
      size: 250,
      minSize: 200,
      maxSize: 300,
    },
    {
      accessorKey: "fileSize",
      header: () => (
        <SortableHeader
          label={t('table.size')}
          column="size"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => <div className="text-sm text-muted-foreground">{formatBytes(row.getValue("fileSize"))}</div>,
      size: 100,
      minSize: 80,
      maxSize: 120,
    },
    {
      accessorKey: "format",
      header: () => (
        <SortableHeader
          label={t('table.type')}
          column="type"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => (
        <div className="uppercase text-sm font-medium text-muted-foreground">{row.getValue("format")}</div>
      ),
      size: 80,
      minSize: 60,
      maxSize: 100,
    },
    {
      accessorKey: "updatedAt",
      header: () => (
        <SortableHeader
          label={t('table.lastModified')}
          column="updatedAt"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => {
        const dateStr = format(new Date(row.getValue("updatedAt")), "yyyy-MM-dd HH:mm");
        return <div className="text-sm text-muted-foreground">{dateStr}</div>;
      },
      size: 150,
      minSize: 130,
      maxSize: 170,
    },
    {
      accessorKey: "createdAt",
      header: () => (
        <SortableHeader
          label={t('table.createdDate')}
          column="createdAt"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => {
        const dateStr = format(new Date(row.getValue("createdAt")), "yyyy-MM-dd HH:mm");
        return <div className="text-sm text-muted-foreground">{dateStr}</div>;
      },
      size: 150,
      minSize: 130,
      maxSize: 170,
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const image = row.original;

        const handleDownload = async () => {
          try {
            const buffer = await window.electronAPI?.loadLocalImage(image.uuid, image.format)
            if (!buffer) {
              throw "cannot read file"
            }
            const blob = new Blob([buffer as unknown as BlobPart], { type: image.mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = image.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success(`Downloaded ${image.filename}`);
          } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to download image');
          }
        };

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="*:cursor-pointer *:hover:bg-gray-100">
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(image.uuid)}
              >
                <Copy className="mr-2 h-4 w-4" />
                {t('contextMenu.copyId')}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => onEditExif(image)}>
                <Edit className="mr-2 h-4 w-4" />
                {'Edit EXIF'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewImage(image)}>
                <Eye className="mr-2 h-4 w-4" />
                {t('contextMenu.viewDetails')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                {t('contextMenu.download')}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                {t('contextMenu.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 60,
      minSize: 60,
      maxSize: 60,
    },
  ];

export default function LocalDetailList() {
  const { t } = useTranslation()
  const { openViewer } = useImageViewerStore()
  const { openTiffViewer } = useTiffImageViewerStore()
  const { refreshTrigger } = useGalleryRefreshStore()
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [isLoading, setIsLoading] = React.useState(false)
  const { openEditor } = useExifEditorStore()
  // Backend sorting state
  const [sortBy, setSortBy] = React.useState<'name' | 'size' | 'type' | 'updatedAt' | 'createdAt' | null>('createdAt')
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc')

  const [data, setData] = React.useState<ImageWithSource[]>([])
  const [pagination, setPagination] = React.useState({
    page: 1,
    pageSize: 5,
    totalItems: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  })

  const fetchData = async (page: number, pageSize: number) => {
    setIsLoading(true)
    try {
      // Map sort field names from UI to database column names
      const sortByMap: Record<string, 'filename' | 'fileSize' | 'format' | 'updatedAt' | 'createdAt'> = {
        'name': 'filename',
        'size': 'fileSize',
        'type': 'format',
        'updatedAt': 'updatedAt',
        'createdAt': 'createdAt',
      };

      const dbSortBy = sortBy ? sortByMap[sortBy] : undefined;
      const result = await localDatabase.getPaginatedImages(page, pageSize, dbSortBy, sortOrder);

      // Convert local images to ImageWithSource format
      const images: ImageWithSource[] = result.images.map((localImg: any) => ({
        id: localImg.id,
        uuid: localImg.uuid,
        filename: localImg.filename,
        fileSize: localImg.fileSize,
        format: localImg.format,
        width: localImg.width,
        height: localImg.height,
        hash: localImg.hash,
        mimeType: localImg.mimeType,
        isCorrupted: localImg.isCorrupted,
        createdAt: localImg.createdAt,
        updatedAt: localImg.updatedAt,
        deletedAt: localImg.deletedAt,
        exifData: localImg.exifData ? JSON.parse(localImg.exifData) : null,
        source: 'local' as const,
        aspectRatio: localImg.width && localImg.height ? localImg.width / localImg.height : undefined,
      }));

      setData(images);

      const totalPages = Math.ceil(result.total / pageSize);
      setPagination({
        page,
        pageSize,
        totalItems: result.total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      });
    } catch (error) {
      console.error("Failed to fetch local images:", error);
    } finally {
      setIsLoading(false)
    }
  };

  React.useEffect(() => {
    fetchData(pagination.page, pagination.pageSize);
  }, [pagination.page, pagination.pageSize, sortBy, sortOrder]);

  // Listen for gallery refresh trigger
  React.useEffect(() => {
    if (refreshTrigger > 0) {
      fetchData(pagination.page, pagination.pageSize);
    }
  }, [refreshTrigger]);

  // Handle sort column click
  const handleSort = (column: 'name' | 'size' | 'type' | 'updatedAt' | 'createdAt') => {
    if (sortBy === column) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else if (sortOrder === 'desc') {
        setSortBy(null);
        setSortOrder('desc');
      }
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setRowSelection({});
  };

  // Export selected images as zip
  const handleExport = async () => {
    const selectedUuids = Object.keys(rowSelection);
    if (selectedUuids.length === 0) {
      toast.error('Please select at least one image to export');
      return;
    }

    try {
      setIsLoading(true);
      const selectedImages = data.filter(img => selectedUuids.includes(img.uuid));

      // Use Electron's export API
      const destination = await window.electronAPI?.selectDirectory();
      if (!destination) {
        setIsLoading(false);
        return; // User cancelled
      }

      const imagesToExport = selectedImages.map(img => ({
        uuid: img.uuid,
        format: img.format,
        filename: img.filename,
      }));

      const result = await window.electronAPI?.exportImages(imagesToExport, destination);

      if (result?.success) {
        toast.success(`Successfully exported ${selectedImages.length} images to ${destination}`);
      } else {
        toast.error('Failed to export some images. Check console for details.');
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export images. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete selected images
  const handleDelete = async () => {
    const selectedUuids = Object.keys(rowSelection);
    if (selectedUuids.length === 0) {
      toast.error(t('table.selectAtLeastOne'));
      return;
    }

    if (!window.confirm(t('table.confirmDelete', { count: selectedUuids.length }))) {
      return;
    }

    try {
      setIsLoading(true);
      toast.loading('Deleting images...', { id: 'delete-local-table' });
      await localImageService.deleteImages(selectedUuids);

      // Clear selection and refresh data
      setRowSelection({});
      fetchData(pagination.page, pagination.pageSize);
      toast.success(`Successfully deleted ${selectedUuids.length} images`, { id: 'delete-local-table' });
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error(t('table.deleteError'), { id: 'delete-local-table' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewImage = React.useCallback((image: ImageWithSource) => {


    if (image.format === 'tiff') {
      openTiffViewer(image);
      return;
    } else {

      openViewer(image, data);
    }


  }, [openViewer, openTiffViewer, data]);

  const handleEditExif = (image: ImageWithSource) => {
    openEditor(image);
  };


  // Create columns with current sort state
  const columns = React.useMemo(
    () => createLocalColumns(sortBy, sortOrder, handleSort, t, handleViewImage, handleEditExif),
    [sortBy, sortOrder, t, handleSort, handleViewImage]
  );

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    manualPagination: true,
    pageCount: pagination.totalPages,
    columnResizeMode: 'onChange',
    enableColumnResizing: false,
    getRowId: (row) => row.uuid,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination: {
        pageIndex: pagination.page - 1,
        pageSize: pagination.pageSize,
      }
    },
  })

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPagination(prev => ({
      ...prev,
      page: 1,
      pageSize: newPageSize
    }));
  }

  const goToFirstPage = () => handlePageChange(1);
  const goToLastPage = () => handlePageChange(pagination.totalPages);
  const goToPreviousPage = () => handlePageChange(pagination.page - 1);
  const goToNextPage = () => handlePageChange(pagination.page + 1);

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Filter and Column Visibility Controls */}
      <div className="flex items-center justify-between shrink-0">
        <Input
          placeholder={t('table.filterByName')}
          value={(table.getColumn("filename")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("filename")?.setFilterValue(event.target.value)
          }
          className="max-w-sm border-gray-300 ring-gray-400"
        />
        <div className="flex items-center gap-2">
          {/* Selection Controls - shown only when items are selected */}
          {Object.keys(rowSelection).length > 0 && (
            <>
              <span className="text-sm text-gray-600">
                {Object.keys(rowSelection).length} {t('gallery.selected')}
              </span>
              <Button
                size="sm"
                onClick={handleExport}
                disabled={Object.keys(rowSelection).length === 0 || isLoading}
                className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                {isLoading ? t('gallery.exporting') : `${t('table.export')} (${Object.keys(rowSelection).length})`}
              </Button>
              <Button
                size="sm"
                onClick={handleDelete}
                disabled={Object.keys(rowSelection).length === 0 || isLoading}
                className="flex items-center gap-2 bg-red-600 text-white hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
                {t('table.delete')} ({Object.keys(rowSelection).length})
              </Button>
              <Button
                size="sm"
                onClick={() => setRowSelection({})}
                className="flex items-center gap-2 border-gray-100 border hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
                {t('table.clearSelection')}
              </Button>
            </>
          )}

          {/* Column Visibility Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"
                className="border-gray-200"
              >
                {t('table.columns')} <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize cursor-pointer hover:bg-gray-100 duration-75"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table with Scroll Container */}
      <div className="flex-1 min-h-0 rounded-md  overflow-auto">
        <Table style={{ tableLayout: 'fixed', width: '100%' }}>
          <TableHeader
            className="bg-slate-100 [&_tr]:border-b-0! **:font-semibold"
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className="h-10 px-2 "
                      style={{ width: `${header.getSize()}px` }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody
            className="border-0"
          >
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <span className="ml-2 text-sm text-muted-foreground">{t('common.loading')}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-gray-300 h-18 hover:bg-slate-50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="py-2 px-2"
                      style={{ width: `${cell.column.getSize()}px` }}
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
                  <div className="text-muted-foreground">{t('table.noImages')}</div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex-1 text-sm text-muted-foreground">
          {Object.keys(rowSelection).length > 0 && (
            <span>{t('table.rowsSelected', { count: Object.keys(rowSelection).length })}</span>
          )}
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8 **:ring-0!">
          {/* Page Size Selector */}
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">{t('table.rowsPerPage')}</p>
            <Select

              value={`${pagination.pageSize}`}
              onValueChange={(value) => handlePageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px] border-gray-200 cursor-pointer ">
                <SelectValue placeholder={pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[5, 10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem
                    className="cursor-pointer"
                    key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page Info */}
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            {t('table.pageInfo', { current: pagination.page, total: pagination.totalPages })}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center space-x-2 *:border-gray-200">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={goToFirstPage}
              disabled={!pagination.hasPrev}
            >
              <span className="sr-only">{t('table.goToFirstPage')}</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={goToPreviousPage}
              disabled={!pagination.hasPrev}
            >
              <span className="sr-only">{t('table.goToPreviousPage')}</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={goToNextPage}
              disabled={!pagination.hasNext}
            >
              <span className="sr-only">{t('table.goToNextPage')}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={goToLastPage}
              disabled={!pagination.hasNext}
            >
              <span className="sr-only">{t('table.goToLastPage')}</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
