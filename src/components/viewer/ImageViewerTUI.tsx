import React, { useCallback, useEffect, useRef, useState } from 'react';
import ImageEditor from 'tui-image-editor';
import 'tui-image-editor/dist/tui-image-editor.css';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { useImageViewerFilerobotStore } from '@/stores/imageViewerFilerobotStore';
import { useGalleryRefreshStore } from '@/stores/galleryRefreshStore';
import { localImageService } from '@/services/localImage.service';
import { generateThumbnail } from '@/utils/thumbnailGenerator';
import { blobToFile } from '@/utils/cropImage';
import { getCloudImagePresignedUrlEndpoint } from '@/utils/imagePaths';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import type { LocalImage } from '@/types/local';

export const ImageViewerTUI: React.FC = () => {
  // ---------------------------------------------------------------------------
  // Functional Logic (Unchanged)
  // ---------------------------------------------------------------------------
  const { isOpen, currentImage, isLocalImage, closeEditor } =
    useImageViewerFilerobotStore();
  const { triggerRefresh } = useGalleryRefreshStore();
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const editorRef = useRef<ImageEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentImage || !isOpen) {
      setImageUrl('');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const loadImage = async () => {
      try {
        if (isLocalImage) {
          const buffer = await window.electronAPI?.loadLocalImage(
            currentImage.uuid,
            currentImage.format
          );
          if (buffer) {
            const blob = new Blob([buffer as unknown as BlobPart], {
              type: currentImage.mimeType || 'image/jpeg',
            });
            const blobUrl = URL.createObjectURL(blob);
            setImageUrl(blobUrl);
          }
        } else {
          const endpoint = getCloudImagePresignedUrlEndpoint(currentImage.uuid);
          const response = await fetch(endpoint);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.presignedUrl) {
              setImageUrl(data.data.presignedUrl);
            }
          }
        }
      } catch (error) {
        console.error('Error loading image:', error);
        toast.error('Failed to load image');
      } finally {
        setIsLoading(false);
      }
    };
    loadImage();
    return () => {
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [currentImage, isLocalImage, isOpen]);

  // Define callbacks BEFORE the useEffect that uses them
  const handleClose = useCallback(() => {
    if (imageUrl && imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl('');
    if (editorRef.current) {
      editorRef.current.destroy();
      editorRef.current = null;
    }
    closeEditor();
  }, [imageUrl, closeEditor]);

  const handleSave = useCallback(
    async (replaceOriginal: boolean) => {
      if (!currentImage || !editorRef.current) return;
      try {
        const dataURL = editorRef.current.toDataURL({
          format: currentImage.format === 'png' ? 'png' : 'jpeg',
          quality: 0.92,
        });
        const response = await fetch(dataURL);
        const blob = await response.blob();
        const format = currentImage.format === 'png' ? 'png' : 'jpeg';
        const fileName = replaceOriginal
          ? currentImage.filename
          : `edited_${currentImage.filename}`;
        const file = blobToFile(blob, fileName);

        if (isLocalImage) {
          const arrayBuffer = await file.arrayBuffer();
          const imageUuid = replaceOriginal ? currentImage.uuid : uuidv4();
          const savedPath = await window.electronAPI?.saveImageBuffer(
            imageUuid,
            format,
            arrayBuffer
          );
          if (!savedPath) {
            throw new Error('Failed to save edited image');
          }
          try {
            await generateThumbnail(savedPath, imageUuid, 300);
          } catch (error) {
            console.error('Failed to generate thumbnail:', error);
          }
          if (replaceOriginal) {
            await localImageService.updateImage(currentImage.uuid, {
              fileSize: file.size,
              updatedAt: new Date().toISOString(),
            });
          } else {
            const newImage: LocalImage = {
              uuid: imageUuid,
              filename: fileName,
              fileSize: file.size,
              format: format as any,
              width: editorRef.current.getCanvasSize().width,
              height: editorRef.current.getCanvasSize().height,
              hash: '',
              mimeType: file.type,
              isCorrupted: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              deletedAt: null,
              pageCount: 1,
              exifData: currentImage.exifData,
            };
            await localImageService.addImage(newImage);
          }
        } else {
          if (replaceOriginal) {
            const { replaceImages } = await import('@/services/images.service');
            const result = await replaceImages([{
              uuid: currentImage.uuid,
              file: file,
            }]);
            if (result.stats.failed > 0) {
              const error = result.errors[0];
              throw new Error(error?.error || 'Failed to replace image');
            }
          } else {
            const { requestPresignedURLs, uploadToPresignedURL } = await import(
              '@/services/images.service'
            );
            const { generateThumbnailBlob } = await import('@/utils/thumbnailGenerator');
            const newUuid = uuidv4();
            const canvasSize = editorRef.current.getCanvasSize();
            const arrayBuffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
            const presignedURLs = await requestPresignedURLs([
              {
                uuid: newUuid,
                filename: fileName,
                fileSize: file.size,
                format,
                width: canvasSize.width,
                height: canvasSize.height,
                hash,
                mimeType: file.type,
                isCorrupted: false,
              },
            ] as any);
            if (!presignedURLs || presignedURLs.length === 0) {
              throw new Error('Failed to get presigned URLs');
            }
            const urls = presignedURLs[0];
            const thumbnailBlob = await generateThumbnailBlob(file, 300);
            await uploadToPresignedURL(urls.thumbnailUrl, thumbnailBlob, true);
            await uploadToPresignedURL(urls.imageUrl, file, false);
          }
        }
        toast.success(replaceOriginal ? 'Image replaced successfully' : 'Image saved successfully');
        triggerRefresh();
        handleClose();
      } catch (error) {
        console.error('Error saving edited image:', error);
        toast.error('Failed to save edited image. Please try again.');
      }
    },
    [currentImage, isLocalImage, triggerRefresh, handleClose]
  );

  // Initialize TUI Image Editor
  useEffect(() => {
    if (!containerRef.current || !imageUrl || isLoading) return;

    if (editorRef.current) {
      editorRef.current.destroy();
      editorRef.current = null;
    }

    editorRef.current = new ImageEditor(containerRef.current, {
      includeUI: {
        loadImage: {
          path: imageUrl,
          name: currentImage?.filename || 'image',
        },
        theme: EDITOR_THEME,
        menu: ['crop', 'flip', 'rotate', 'draw', 'shape', 'icon', 'text', 'filter'],
        initMenu: 'filter',
        uiSize: {
          width: '100%',
          height: '100%',
        },
        menuBarPosition: 'bottom',
      },
      usageStatistics: false,
    });

    // Inject custom buttons into TUI's help menu (non-absolute approach)
    const injectCustomButtons = () => {
      const helpMenu = containerRef.current?.querySelector('.tui-image-editor-help-menu.top');
      if (!helpMenu) return;

      // Check if already injected
      if (helpMenu.querySelector('.custom-tui-buttons')) return;

      // Create container for our buttons
      const customButtons = document.createElement('div');
      customButtons.className = 'custom-tui-buttons';
      customButtons.style.cssText = 'display: flex; align-items: center; gap: 4px; margin-left: 8px; padding-left: 8px; border-left: 1px solid #4a4a4a;';

      // Save New button
      const saveNewBtn = document.createElement('button');
      saveNewBtn.className = 'custom-btn-save-new';
      saveNewBtn.title = 'Save as a new copy';
      saveNewBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg><span>Save New</span>`;
      saveNewBtn.onclick = () => handleSave(false);

      // Replace button
      const replaceBtn = document.createElement('button');
      replaceBtn.className = 'custom-btn-replace';
      replaceBtn.title = 'Overwrite original file';
      replaceBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg><span>Replace</span>`;
      replaceBtn.onclick = () => handleSave(true);

      // Close button
      const closeBtn = document.createElement('button');
      closeBtn.className = 'custom-btn-close';
      closeBtn.title = 'Close without saving';
      closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span>Close</span>`;
      closeBtn.onclick = () => handleClose();

      // Right side container (separator + close)
      const rightGroup = document.createElement('div');
      rightGroup.className = 'custom-right-group';
      const separator = document.createElement('div');
      separator.className = 'custom-separator';
      rightGroup.appendChild(separator);
      rightGroup.appendChild(closeBtn);

      customButtons.appendChild(saveNewBtn);
      customButtons.appendChild(replaceBtn);
      helpMenu.appendChild(customButtons);
      helpMenu.appendChild(rightGroup);
    };

    // Wait for TUI to fully render
    setTimeout(injectCustomButtons, 100);

    return () => {
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, [imageUrl, isLoading, currentImage?.filename, handleSave, handleClose]);

  if (!currentImage) return null;

  // ---------------------------------------------------------------------------
  // Render (Visual Update)
  // ---------------------------------------------------------------------------
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0 bg-[#1e1e1e] border-none overflow-hidden"
        aria-describedby={undefined}
        hideCloseButton
      >
        <VisuallyHidden.Root>
          <DialogTitle>Edit: {currentImage.filename}</DialogTitle>
        </VisuallyHidden.Root>

        {/* Loading state */}
        {(isLoading || !imageUrl) && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e] z-50">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
          </div>
        )}

        {/* Inject custom styles */}
        <style dangerouslySetInnerHTML={{ __html: TUI_CUSTOM_STYLES }} />

        {/* TUI Editor container - custom buttons injected via DOM */}
        <div className="w-full h-full">
          <div ref={containerRef} className="w-full h-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Configuration Constants (Moved to bottom for code cleanliness)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Configuration Constants (Modern Dark Theme)
// ---------------------------------------------------------------------------

const TUI_CUSTOM_STYLES = `
  /* 1. HIDE ALL LOAD/DOWNLOAD BUTTONS AND LOGOS */
  .tui-image-editor-header-logo,
  .tui-image-editor-header-buttons,
  .tui-image-editor-controls-logo,
  .tui-image-editor-controls-buttons,
  .tui-image-editor-load-btn,
  .tui-image-editor-download-btn {
    display: none !important;
  }

  /* 2. HEADER - Clean styling */
  .tui-image-editor-header {
    background-color: #1a1a1a !important;
    border-bottom: 1px solid #333 !important;
  }

  /* 3. TOP HELP MENU - Unified toolbar (contains TUI + custom buttons) */
  .tui-image-editor-help-menu.top {
    background: #2a2a2a !important;
    border: 1px solid #3a3a3a !important;
    border-radius: 8px !important;
    left: 12px !important;
    right: 12px !important;
    transform: none !important;
    padding: 6px 12px !important;
    top: 12px !important;
    gap: 4px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
  }

  /* 4. HIDE unwanted tools: Zoom, Hand, History, Delete + separators */
  .tie-btn-zoomIn,
  .tie-btn-zoomOut,
  .tie-btn-hand,
  .tie-btn-history,
  .tie-btn-delete,
  .tie-btn-deleteAll,
  .tui-image-editor-help-menu .tui-image-editor-item:has(.tui-image-editor-icpartition),
  .tui-image-editor-icpartition {
    display: none !important;
  }

  /* 5. KEEP VISIBLE: Undo, Redo, Reset - Style them */
  .tie-btn-undo,
  .tie-btn-redo,
  .tie-btn-reset {
    display: inline-flex !important;
    padding: 6px !important;
    border-radius: 4px !important;
    transition: background 0.15s !important;
  }
  .tie-btn-undo:hover,
  .tie-btn-redo:hover,
  .tie-btn-reset:hover {
    background: rgba(255,255,255,0.1) !important;
  }

  /* 6. CUSTOM INJECTED BUTTONS STYLING */
  .custom-tui-buttons {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    padding-left: 8px;
    border-left: 1px solid #4a4a4a;
  }

  .custom-btn-save-new,
  .custom-btn-replace {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    background: transparent;
    color: #d1d5db;
  }

  .custom-btn-save-new:hover,
  .custom-btn-replace:hover {
    background: rgba(255,255,255,0.1);
    color: #ffffff;
  }

  .custom-btn-save-new svg,
  .custom-btn-replace svg {
    stroke: currentColor;
  }

  .custom-right-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .custom-separator {
    width: 1px;
    height: 20px;
    background: #4a4a4a;
  }

  .custom-btn-close {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    background: transparent;
    color: #d1d5db;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .custom-btn-close:hover {
    background: rgba(255,255,255,0.1);
    color: #ffffff;
  }
  .custom-btn-close svg {
    stroke: currentColor;
  }

  /* 7. ICON STYLING (Gray -> White) */
  .tui-image-editor-menu svg,
  .tui-image-editor-menu use,
  .tui-image-editor-submenu svg,
  .tui-image-editor-submenu use,
  .tui-image-editor-header svg,
  .tui-image-editor-header use {
    fill: #9ca3af !important;
    stroke: #9ca3af !important;
    transition: all 0.2s ease;
  }

  /* Hover State */
  .tui-image-editor-help-menu li:hover svg,
  .tui-image-editor-help-menu li:hover use {
    fill: #ffffff !important;
    stroke: #ffffff !important;
  }

  /* Active State */
  .active svg, .active use {
    fill: #1a1a1a !important;
    stroke: #1a1a1a !important;
  }

  /* 8. SUBMENU & BUTTON POLISH */
  .tui-image-editor-submenu {
    background-color: #262626 !important;
  }

  .tui-image-editor-submenu-item .tui-image-editor-button {
    border: 1px solid transparent !important;
    background-color: transparent !important;
    border-radius: 6px !important;
  }
  .tui-image-editor-submenu-item .tui-image-editor-button:hover {
    background-color: rgba(255, 255, 255, 0.1) !important;
  }
  .tui-image-editor-submenu-item.active .tui-image-editor-button {
    background-color: rgba(255, 255, 255, 0.15) !important;
  }

  // /* Apply/Cancel Pills */
  // .tui-image-editor-button.apply {
  //   background-color: #2563eb !important;
  //   border: 1px solid #3b82f6 !important;
  //   border-radius: 20px !important;
  // }
  // .tui-image-editor-button.cancel {
  //   background-color: #374151 !important;
  //   border: 1px solid #4b5563 !important;
  //   border-radius: 20px !important;
  // }

  /* Center the Bottom Toolbar */
  .tui-image-editor-header-menu { justify-content: center !important; }

  /* Bottom submenu button padding */
  .tui-image-editor-submenu-item .tui-image-editor-button {
    padding: 8px 12px !important;
    margin: 0 2px !important;
    cursor: pointer !important;
  }
  .tui-image-editor-submenu-item .tui-image-editor-button * {
    cursor: pointer !important;
  }

  /* Prevent layout jitter on hover */
  .tui-image-editor-submenu-item .tui-image-editor-button label,
  .tui-image-editor-submenu-item .tui-image-editor-button span {
    font-weight: normal !important;
    font-size: inherit !important;
    transition: color 0.15s ease !important;
  }
  .tui-image-editor-submenu-item:hover .tui-image-editor-button label,
  .tui-image-editor-submenu-item:hover .tui-image-editor-button span,
  .tui-image-editor-submenu-item.active .tui-image-editor-button label,
  .tui-image-editor-submenu-item.active .tui-image-editor-button span {
    font-weight: normal !important;
    font-size: inherit !important;
  }
`;
const EDITOR_THEME = {
  'common.backgroundColor': '#1a1a1a',
  'common.border': '0px',
  'header.backgroundColor': '#1a1a1a',
  'header.border': '0px',

  // Buttons (Hidden but required)
  'loadButton.backgroundColor': '#fff',
  'loadButton.border': '1px solid #ddd',
  'loadButton.color': '#222',
  'loadButton.fontFamily': 'sans-serif',
  'loadButton.fontSize': '12px',
  'downloadButton.backgroundColor': '#fdba74',
  'downloadButton.border': '1px solid #fdba74',
  'downloadButton.color': '#000',
  'downloadButton.fontFamily': 'sans-serif',
  'downloadButton.fontSize': '12px',

  // Main Menu (Bottom Bar)
  'menu.backgroundColor': '#1a1a1a',
  'menu.normalIcon.color': '#9ca3af',
  'menu.activeIcon.color': '#1a1a1a', // FIX: Dark icon when active
  'menu.disabledIcon.color': '#444444',
  'menu.hoverIcon.color': '#ffffff',
  'menu.iconSize.width': '24px',
  'menu.iconSize.height': '24px',

  // Sub Menu (Top Tray)
  'submenu.backgroundColor': '#262626',
  'submenu.partition.color': '#3f3f46',
  'submenu.normalIcon.color': '#9ca3af',
  'submenu.activeIcon.color': '#1a1a1a', // FIX: Dark icon when active
  'submenu.iconSize.width': '32px',
  'submenu.iconSize.height': '32px',

  'submenu.normalLabel.color': '#d1d5db',
  'submenu.normalLabel.fontWeight': 'normal',
  'submenu.activeLabel.color': '#ffffff',
  'submenu.activeLabel.fontWeight': 'bold',

  'checkbox.border': '1px solid #52525b',
  'checkbox.backgroundColor': '#27272a',

  'range.pointer.color': '#fff',
  'range.bar.color': '#52525b',
  'range.subbar.color': '#3b82f6',
  'range.disabledPointer.color': '#414141',
  'range.disabledBar.color': '#282828',
  'range.disabledSubbar.color': '#414141',
  'range.value.color': '#fff',
  'range.value.fontWeight': 'normal',
  'range.value.fontSize': '11px',
  'range.value.border': '0px',
  'range.value.backgroundColor': '#262626',
  'range.title.color': '#fff',
  'range.title.fontWeight': 'normal',
  'colorpicker.button.border': '0px',
  'colorpicker.title.color': '#fff',
};