import { Upload, FolderUp } from 'lucide-react'
import { useState } from 'react'

export default function LeftPanel() {
  const [uploadStats, setUploadStats] = useState({
    totalFiles: 0,
    totalSize: 0,
    successCount: 0,
    errorCount: 0,
    corruptedCount: 0
  })

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="w-80 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Upload</h2>
      </div>

      {/* Upload Area */}
      <div className="p-4 space-y-4">
        {/* Drag & Drop Area */}
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
          <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            Drag & drop images here
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            or click to browse
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Supported: JPG, PNG, TIF
          </p>
        </div>

        {/* JSON Batch Upload */}
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-green-500 transition-colors cursor-pointer">
          <FolderUp className="w-10 h-10 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
            Batch Upload
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Upload folder config JSON
          </p>
        </div>
      </div>

      {/* Upload Statistics */}
      <div className="flex-1 p-4 overflow-y-auto">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Upload Statistics
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Total Files:</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {uploadStats.totalFiles}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Total Size:</span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {formatSize(uploadStats.totalSize)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Success:</span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {uploadStats.successCount}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Errors:</span>
            <span className="font-medium text-red-600 dark:text-red-400">
              {uploadStats.errorCount}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Corrupted:</span>
            <span className="font-medium text-yellow-600 dark:text-yellow-400">
              {uploadStats.corruptedCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
