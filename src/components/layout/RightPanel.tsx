import { X, ChevronRight } from 'lucide-react'
import { useState } from 'react'

interface RightPanelProps {
  onClose: () => void
}

export default function RightPanel({ onClose }: RightPanelProps) {
  const [selectedImage, setSelectedImage] = useState<any>(null)

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Details
        </h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedImage ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select an image to view details
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Image Preview */}
            <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
              <img
                src={selectedImage.thumbnail}
                alt={selectedImage.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* File Info */}
            <div>
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase">
                File Information
              </h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Filename</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                    {selectedImage.name}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Format</p>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{selectedImage.format}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Size</p>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{selectedImage.size}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Dimensions</p>
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {selectedImage.dimensions}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Upload Date</p>
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {selectedImage.uploadDate}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div>
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase">
                Metadata (EXIF)
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Camera</span>
                  <span className="text-gray-800 dark:text-gray-200">N/A</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">ISO</span>
                  <span className="text-gray-800 dark:text-gray-200">N/A</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Exposure</span>
                  <span className="text-gray-800 dark:text-gray-200">N/A</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2">
              <button className="w-full flex items-center justify-between px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium">
                <span>View Full Image</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
