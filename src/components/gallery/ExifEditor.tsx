import React, { useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { useExifEditorStore } from '@/stores/exifEditorStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const ExifEditor: React.FC = () => {
  const {
    isOpen,
    image,
    exifData,
    hasChanges,
    closeEditor,
    updateField,
    saveChanges,
  } = useExifEditorStore();

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!hasChanges) return;

    try {
      setSaving(true);
      await saveChanges();

      // Close the editor after successful save
      setTimeout(() => closeEditor(), 500);
    } catch (error) {
      console.error('Failed to save EXIF data:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeEditor();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-900">
        <DialogHeader className="bg-white dark:bg-gray-900">
          <DialogTitle>EXIF Editor</DialogTitle>
          <DialogDescription>
            {image?.filename} • {image?.source === 'local' ? 'Local Mode' : 'Cloud Mode'}
          </DialogDescription>
          {image?.format?.toLowerCase() === 'tiff' && (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Multi-page TIFF:</strong> EXIF metadata applies to the entire file (all pages).
                Changes are saved to the database and will be preserved when exporting or converting.
              </p>
            </div>
          )}
        </DialogHeader>

        <div className="flex justify-end gap-2 px-6 bg-white dark:bg-gray-900">
          <Button
            variant="outline"
            size="sm"
            onClick={() => closeEditor()}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save
          </Button>
        </div>

        <ScrollArea className="max-h-[calc(90vh-12rem)] px-6 bg-white dark:bg-gray-900">
          <Tabs defaultValue="camera" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="camera">Camera</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="metadata">Metadata</TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
            </TabsList>

            {/* Camera Tab */}
            <TabsContent value="camera" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cameraMake">Camera Make</Label>
                  <Input
                    id="cameraMake"
                    value={exifData.cameraMake || ''}
                    onChange={(e) => updateField('cameraMake', e.target.value)}
                    placeholder="e.g., Canon"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cameraModel">Camera Model</Label>
                  <Input
                    id="cameraModel"
                    value={exifData.cameraModel || ''}
                    onChange={(e) => updateField('cameraModel', e.target.value)}
                    placeholder="e.g., EOS R5"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lensModel">Lens Model</Label>
                <Input
                  id="lensModel"
                  value={exifData.lensModel || ''}
                  onChange={(e) => updateField('lensModel', e.target.value)}
                  placeholder="e.g., RF 24-70mm F2.8 L IS USM"
                />
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="iso">ISO</Label>
                  <Input
                    id="iso"
                    type="number"
                    value={exifData.iso || ''}
                    onChange={(e) => updateField('iso', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="e.g., 100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aperture">Aperture</Label>
                  <Input
                    id="aperture"
                    value={exifData.aperture || ''}
                    onChange={(e) => updateField('aperture', e.target.value)}
                    placeholder="e.g., f/2.8"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shutterSpeed">Shutter Speed</Label>
                  <Input
                    id="shutterSpeed"
                    value={exifData.shutterSpeed || ''}
                    onChange={(e) => updateField('shutterSpeed', e.target.value)}
                    placeholder="e.g., 1/250"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="focalLength">Focal Length</Label>
                  <Input
                    id="focalLength"
                    value={exifData.focalLength || ''}
                    onChange={(e) => updateField('focalLength', e.target.value)}
                    placeholder="e.g., 50mm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="orientation">Orientation</Label>
                <Input
                  id="orientation"
                  type="number"
                  min="1"
                  max="8"
                  value={exifData.orientation || ''}
                  onChange={(e) => updateField('orientation', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="1-8"
                />
              </div>
            </TabsContent>

            {/* Metadata Tab */}
            <TabsContent value="metadata" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="artist">Artist</Label>
                <Input
                  id="artist"
                  value={exifData.artist || ''}
                  onChange={(e) => updateField('artist', e.target.value)}
                  placeholder="Photographer name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="copyright">Copyright</Label>
                <Input
                  id="copyright"
                  value={exifData.copyright || ''}
                  onChange={(e) => updateField('copyright', e.target.value)}
                  placeholder="Copyright information"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="software">Software</Label>
                <Input
                  id="software"
                  value={exifData.software || ''}
                  onChange={(e) => updateField('software', e.target.value)}
                  placeholder="e.g., Adobe Lightroom"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTaken">Date Taken</Label>
                <Input
                  id="dateTaken"
                  type="datetime-local"
                  value={
                    exifData.dateTaken
                      ? new Date(exifData.dateTaken).toISOString().slice(0, 16)
                      : ''
                  }
                  onChange={(e) =>
                    updateField(
                      'dateTaken',
                      e.target.value ? new Date(e.target.value).toISOString() : null
                    )
                  }
                />
              </div>
            </TabsContent>

            {/* Location Tab */}
            <TabsContent value="location" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="gpsLatitude">GPS Latitude</Label>
                <Input
                  id="gpsLatitude"
                  value={exifData.gpsLatitude || ''}
                  onChange={(e) => updateField('gpsLatitude', e.target.value)}
                  placeholder="e.g., 37.7749"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gpsLongitude">GPS Longitude</Label>
                <Input
                  id="gpsLongitude"
                  value={exifData.gpsLongitude || ''}
                  onChange={(e) => updateField('gpsLongitude', e.target.value)}
                  placeholder="e.g., -122.4194"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gpsAltitude">GPS Altitude</Label>
                <Input
                  id="gpsAltitude"
                  value={exifData.gpsAltitude || ''}
                  onChange={(e) => updateField('gpsAltitude', e.target.value)}
                  placeholder="e.g., 100"
                />
              </div>
              {exifData.gpsLatitude && exifData.gpsLongitude && (
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground">
                    Location: {exifData.gpsLatitude}, {exifData.gpsLongitude}
                    {exifData.gpsAltitude && ` (${exifData.gpsAltitude}m)`}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {hasChanges && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                You have unsaved changes. Click Save to apply them.
              </p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ExifEditor;
