/**
 * Export Dialog for conflict resolution
 * Shows images that will be replaced/deleted and allows user to export them
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LocalImage } from '@/types/local';
import { AlertTriangle, Download, FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  affectedImages: LocalImage[];
  onExport: (imagesToExport: LocalImage[], destination: string) => Promise<void>;
  onSkipExport: () => void;
  onCancel: () => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onOpenChange,
  affectedImages,
  onExport,
  onSkipExport,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [selectedImages, setSelectedImages] = useState<Set<string>>(
    new Set(affectedImages.map((img) => img.uuid))
  );
  const [exporting, setExporting] = useState(false);

  const toggleImage = (uuid: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(uuid)) {
      newSelected.delete(uuid);
    } else {
      newSelected.add(uuid);
    }
    setSelectedImages(newSelected);
  };

  const toggleAll = () => {
    if (selectedImages.size === affectedImages.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(affectedImages.map((img) => img.uuid)));
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);

      // Ask user to select export directory
      const destination = await window.electronAPI?.selectDirectory();
      if (!destination) {
        setExporting(false);
        return; // User cancelled directory selection
      }

      // Export selected images
      const imagesToExport = affectedImages.filter((img) =>
        selectedImages.has(img.uuid)
      );

      await onExport(imagesToExport, destination);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to export images:', error);
      alert('Failed to export images. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleSkip = () => {
    onSkipExport();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {t('sync.exportConflicts', 'Export Conflicting Images')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'sync.exportDescription',
              'The following images will be replaced or deleted. You can export them before proceeding.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Select all checkbox */}
          <div className="flex items-center gap-2 border-b pb-2">
            <Checkbox
              checked={selectedImages.size === affectedImages.length}
              onCheckedChange={toggleAll}
              id="select-all"
            />
            <label
              htmlFor="select-all"
              className="text-sm font-medium cursor-pointer"
            >
              {t('sync.selectAll', 'Select All')} ({affectedImages.length}{' '}
              {t('images', 'images')})
            </label>
          </div>

          {/* Image list */}
          <ScrollArea className="h-[300px] border rounded-md p-4">
            <div className="space-y-2">
              {affectedImages.map((image) => (
                <div
                  key={image.uuid}
                  className="flex items-center gap-3 p-2 hover:bg-accent rounded-md"
                >
                  <Checkbox
                    checked={selectedImages.has(image.uuid)}
                    onCheckedChange={() => toggleImage(image.uuid)}
                    id={`image-${image.uuid}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {image.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(image.fileSize / 1024 / 1024).toFixed(2)} MB •{' '}
                      {image.format} • {image.width} x {image.height}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <p className="text-sm text-muted-foreground">
            {selectedImages.size} of {affectedImages.length}{' '}
            {t('images', 'images')} selected
          </p>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={exporting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="secondary"
            onClick={handleSkip}
            disabled={exporting}
          >
            {t('sync.skipExport', 'Skip Export')}
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedImages.size === 0 || exporting}
          >
            {exporting ? (
              <>
                <Download className="mr-2 h-4 w-4 animate-spin" />
                {t('sync.exporting', 'Exporting...')}
              </>
            ) : (
              <>
                <FolderOpen className="mr-2 h-4 w-4" />
                {t('sync.exportAndContinue', 'Export & Continue')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportDialog;
