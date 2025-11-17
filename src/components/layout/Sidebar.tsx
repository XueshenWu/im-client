import { Upload, FolderUp, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react'
import { useState } from 'react'

export default function Sidebar() {
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'synced' | 'not-synced' | 'error'>('not-synced')
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const handleSync = () => {
    setSyncing(true)
    // Simulate sync
    setTimeout(() => {
      setSyncing(false)
      setSyncStatus('synced')
      setLastSync(new Date())
    }, 2000)
  }

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Never'
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="w-80 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-y-auto">

      {/* Upload Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
          File Upload
        </h2>

        {/* Drag & Drop Area */}
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all cursor-pointer group">
          <Upload className="w-10 h-10 mx-auto mb-2 text-gray-400 group-hover:text-blue-500 transition-colors" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Drop images here
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            or click to browse
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            JPG, PNG, TIF • Max 4K
          </p>
        </div>

        {/* Batch Upload */}
        <div className="mt-3 border border-gray-300 dark:border-gray-600 rounded-lg p-4 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all cursor-pointer group">
          <div className="flex items-center gap-2">
            <FolderUp className="w-5 h-5 text-gray-400 group-hover:text-green-500 transition-colors" />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Batch Upload
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Upload via JSON config
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Control Panel Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
          Sync Control Panel
        </h2>

        {/* Sync Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-3 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Status</span>
            <div className="flex items-center gap-1.5">
              {syncStatus === 'synced' && (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">Synced</span>
                </>
              )}
              {syncStatus === 'not-synced' && (
                <>
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">Pending</span>
                </>
              )}
              {syncStatus === 'error' && (
                <>
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">Error</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-400">Last Sync</span>
            <span className="text-xs text-gray-700 dark:text-gray-300">{formatLastSync(lastSync)}</span>
          </div>
        </div>

        {/* Sync Button */}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors font-medium text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>

        {/* Sync Info */}
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <span className="font-semibold">Sync Strategy:</span> Server Always Wins
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Local changes will be overwritten by server data
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-4 flex-1">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
          Quick Stats
        </h2>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Total Images</span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">0</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Storage Used</span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">0 MB</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Pending Upload</span>
            <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">0</span>
          </div>
        </div>
      </div>
    </div>
  )
}
