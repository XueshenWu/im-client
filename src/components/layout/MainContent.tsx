import { useState } from 'react'
import { Grid3x3, Upload as UploadIcon, FolderUp, RefreshCw, CheckCircle, Clock, Filter, Download, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function MainContent() {
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending'>('pending')
  const [selectedCount, setSelectedCount] = useState(0)
  const [filterType, setFilterType] = useState('all')

  const handleSync = () => {
    setSyncing(true)
    setTimeout(() => {
      setSyncing(false)
      setSyncStatus('synced')
    }, 2000)
  }

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-auto" style={{ padding: '32px' }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Gallery</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage and view your images</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Upload Card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow" style={{ padding: '24px' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              Quick Upload
            </h3>
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
              <UploadIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="space-y-3">
            <Button className="w-full h-auto py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl shadow-sm hover:shadow-md">
              <UploadIcon className="w-4 h-4" />
              Upload Images
            </Button>
            <Button variant="outline" className="w-full h-auto py-3 border-2 hover:border-blue-500 rounded-2xl">
              <FolderUp className="w-4 h-4" />
              Batch Upload
            </Button>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Total Uploaded</span>
              <span className="font-semibold text-gray-900 dark:text-white">0</span>
            </div>
          </div>
        </div>

        {/* Sync Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow" style={{ padding: '24px' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              Sync Status
            </h3>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              syncStatus === 'synced'
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-yellow-100 dark:bg-yellow-900/30'
            }`}>
              {syncStatus === 'synced' ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              )}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${
                syncStatus === 'synced' ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {syncStatus === 'synced' ? 'All Synced' : 'Pending Sync'}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Last sync: {syncStatus === 'synced' ? 'Just now' : 'Never'}
            </p>
          </div>

          <Button
            onClick={handleSync}
            disabled={syncing}
            className="w-full h-auto py-3 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-2xl"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>

        {/* Storage Card */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow" style={{ padding: '24px' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              Storage
            </h3>
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center">
              <Grid3x3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>

          <div className="mb-4">
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">0 MB</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">of unlimited</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Images</span>
              <span className="font-semibold text-gray-900 dark:text-white">0</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full" style={{ width: '0%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Section */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-gray-200 dark:border-gray-700" style={{ paddingLeft: '24px', paddingRight: '24px', paddingTop: '16px', paddingBottom: '16px' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px] text-sm rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="jpg">JPG</SelectItem>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="tif">TIF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {selectedCount > 0 ? (
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {selectedCount} selected
                  </span>
                ) : (
                  <span>0 images</span>
                )}
              </div>
            </div>

            {selectedCount > 0 && (
              <div className="flex items-center gap-2">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 rounded-xl">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
                <Button size="sm" variant="destructive" className="rounded-xl">
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Gallery Content */}
        <div className="min-h-96" style={{ padding: '24px' }}>
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-3xl mb-4">
              <Grid3x3 className="w-12 h-12 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Images Yet
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
              Upload your first images to get started. Supports JPG, PNG, and TIF formats up to 4K resolution.
            </p>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl shadow-sm hover:shadow-md h-auto py-3 px-6">
              <UploadIcon className="w-4 h-4" />
              Upload Images
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
