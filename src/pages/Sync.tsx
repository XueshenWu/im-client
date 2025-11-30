import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { syncClient, SyncEvent } from '@/services/syncClient'
import { getSyncStatus, getMyOperations } from '@/services/sync.service'
import { SyncOperation } from '@/types/api'
import HomeLink from '@/components/common/home-link'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useSettingsStore } from '@/stores/settingsStore'
import { localSyncService } from '@/services/localSync.service'
import { SyncProgress } from '@/types/local'
import { Upload, AlertTriangle, Cloud, HardDrive, RefreshCw } from 'lucide-react'

export default function Sync() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const { sourceMode } = useSettingsStore()

  const [syncInterval, setSyncInterval] = useState<'never' | '30s' | '1m' | '5m'>('never');


  // Cloud mode state
  const [syncStatus, setSyncStatus] = useState<{
    currentSequence: number
    clientLastSequence: number
    isInSync: boolean
    operationsBehind: number
  } | null>(null)
  const [myOperations, setMyOperations] = useState<SyncOperation[]>([])
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncEvents, setSyncEvents] = useState<string[]>([])

  // Local mode state
  const [localSyncStatus, setLocalSyncStatus] = useState<{
    localSeq: number
    serverSeq: number
    localUUID: string | null
    serverUUID: string | null
    inSync: boolean
  } | null>(null)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [localSyncLogs, setLocalSyncLogs] = useState<string[]>([])

  const getPhaseDisplayName = (phase: SyncProgress['phase']): string => {
    const phaseNames: Record<SyncProgress['phase'], string> = {
      initializing: 'Initializing',
      calculating_diff: 'Calculating Differences',
      pull_deleting: 'Deleting Local Files',
      pull_downloading: 'Downloading from Cloud',
      pull_updating: 'Updating Local Metadata',
      pull_replacing: 'Replacing Local Files',
      push_deleting: 'Deleting Remote Files',
      push_uploading: 'Uploading to Cloud',
      push_updating: 'Updating Remote Metadata',
      push_replacing: 'Replacing Remote Files',
      finalizing: 'Finalizing',
      completed: 'Completed',
      failed: 'Failed',
    }
    return phaseNames[phase] || phase
  }

  const addLocalSyncLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logMsg = `[${timestamp}] ${message}`
    setLocalSyncLogs((prev) => [logMsg, ...prev].slice(0, 100)) // Keep last 100 logs
  }

  // Cloud mode: Load sync status and operations
  useEffect(() => {
    if (sourceMode !== 'cloud') return

    loadSyncStatus()
    loadMyOperations()

    // Subscribe to sync events
    const eventListener = (event: SyncEvent) => {
      const timestamp = new Date().toLocaleTimeString()
      const eventMsg = `[${timestamp}] ${event.type}: ${JSON.stringify(event.data || {})}`
      setSyncEvents((prev) => [eventMsg, ...prev].slice(0, 20)) // Keep last 20 events

      if (event.type === 'sync_started') {
        setIsSyncing(true)
      } else if (event.type === 'sync_completed') {
        setIsSyncing(false)
        setLastSyncTime(new Date())
        loadSyncStatus() // Refresh status after sync
      } else if (event.type === 'sync_error') {
        setIsSyncing(false)
      }
    }

    syncClient.addEventListener(eventListener)

    return () => {
      syncClient.removeEventListener(eventListener)
    }
  }, [sourceMode])

  // Local mode: Load sync status and set up progress callback
  useEffect(() => {
    if (sourceMode === 'local') {
      loadLocalSyncStatus()

      // Set up progress callback
      let lastPhase: SyncProgress['phase'] | null = null
      localSyncService.setProgressCallback((progress: SyncProgress) => {
        setSyncProgress(progress)

        // Log phase changes only (not every progress update)
        if (progress.phase !== lastPhase) {
          lastPhase = progress.phase
          if (progress.phase !== 'initializing') {
            addLocalSyncLog(`${getPhaseDisplayName(progress.phase)}: ${progress.message}`)
          }
        }
      })

      return () => {
        // Clean up progress callback
        localSyncService.setProgressCallback(null)
      }
    }
  }, [sourceMode])

  const loadSyncStatus = async () => {
    try {
      const status = await getSyncStatus()
      // IMPORTANT: After the API call, the response interceptor has already updated
      // the client's sequence from the X-Current-Sequence header.
      // We must use the updated client sequence, not the one from before the call.
      const clientSeq = syncClient.getLastSyncSequence()

      // Use the client's current sequence (which was just updated by response interceptor)
      // to determine sync status
      const isInSync = clientSeq === status.currentSequence
      const operationsBehind = Math.max(0, status.currentSequence - clientSeq)

      console.log(`[Sync Page] Loaded status - Server: ${status.currentSequence}, Client: ${clientSeq}, InSync: ${isInSync}`)

      setSyncStatus({
        ...status,
        isInSync,
        operationsBehind,
      })

      setLastSyncTime(new Date())
    } catch (error) {
      console.error('Failed to load sync status:', error)
    }
  }

  const loadMyOperations = async () => {
    try {
      const response = await getMyOperations(10)
      setMyOperations(response.data)
    } catch (error) {
      console.error('Failed to load my operations:', error)
    }
  }

  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      await syncClient.sync()
      await loadSyncStatus()
      await loadMyOperations()
    } catch (error) {
      console.error('Sync failed:', error)
      alert('Sync failed. Check console for details.')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleResetSync = () => {
    if (
      confirm(
        'Are you sure you want to reset sync state? This will set your sequence to 0.'
      )
    ) {
      syncClient.reset()
      loadSyncStatus()
      setSyncEvents([])
      setLastSyncTime(null)
    }
  }

  const handleInitialize = async () => {
    setIsLoading(true)
    try {
      await syncClient.initialize()
      await loadSyncStatus()
      await loadMyOperations()
      alert('Sync initialized successfully!')
    } catch (error) {
      console.error('Initialization failed:', error)
      alert('Initialization failed. Check console for details.')
    } finally {
      setIsLoading(false)
    }
  }

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case 'upload':
        return '⬆️'
      case 'delete':
        return '🗑️'
      case 'update':
        return '✏️'
      case 'replace':
        return '🔄'
      case 'batch_upload':
        return '⬆️📦'
      case 'batch_delete':
        return '🗑️📦'
      default:
        return '❓'
    }
  }

  // Local mode functions
  const loadLocalSyncStatus = async () => {
    if (sourceMode !== 'local') return
    try {
      const status = await localSyncService.checkSyncStatus()
      setLocalSyncStatus(status)
    } catch (error) {
      console.error('Failed to load local sync status:', error)
    }
  }

  const handleLocalSync = async () => {
    if (sourceMode !== 'local') return
    setIsSyncing(true)
    setSyncProgress(null)
    addLocalSyncLog('Starting sync with cloud...')
    try {
      const result = await localSyncService.syncLWW()
      if (result.success) {
        // Add diff summary if available
        if (result.diff) {
          const diff = result.diff
          const totalChanges =
            diff.toUpload.length +
            diff.toDownload.length +
            diff.toDeleteLocal.length +
            diff.toDeleteRemote.length +
            diff.toUpdateLocal.length +
            diff.toUpdateRemote.length +
            diff.toReplaceLocal.length +
            diff.toReplaceRemote.length

          addLocalSyncLog(`📊 Diff Summary: ${totalChanges} total changes`)
          addLocalSyncLog(`  ⬆️ Upload: ${diff.toUpload.length} images`)
          addLocalSyncLog(`  ⬇️ Download: ${diff.toDownload.length} images`)
          addLocalSyncLog(`  🗑️ Delete local: ${diff.toDeleteLocal.length} images`)
          addLocalSyncLog(`  🗑️ Delete remote: ${diff.toDeleteRemote.length} images`)
          addLocalSyncLog(`  ✏️ Update local metadata: ${diff.toUpdateLocal.length} images`)
          addLocalSyncLog(`  ✏️ Update remote metadata: ${diff.toUpdateRemote.length} images`)
          addLocalSyncLog(`  🔄 Replace local: ${diff.toReplaceLocal.length} images`)
          addLocalSyncLog(`  🔄 Replace remote: ${diff.toReplaceRemote.length} images`)
        }

        addLocalSyncLog(`✓ Sync successful: ${result.message}`)
        alert(`Sync successful! ${result.message}`)
        await loadLocalSyncStatus()
      } else {
        addLocalSyncLog(`✗ Sync failed: ${result.message}`)
        alert(`Sync failed: ${result.message}`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      addLocalSyncLog(`✗ Sync error: ${errorMsg}`)
      console.error('Sync failed:', error)
      alert('Sync failed. Check console for details.')
    } finally {
      setIsSyncing(false)
      setSyncProgress(null)
    }
  }

  return (
    <div className="w-full flex flex-col px-6 py-6 h-full gap-6 bg-white">
      <div className="space-y-3 shrink-0">
        <HomeLink />
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-4xl font-bold font-sans text-gray-900">Sync</h1>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg *:flex *:items-center *:justify-center *:gap-2 border border-gray-100 shadow-sm">
            {sourceMode === 'cloud' ? (
              <div>
                <Cloud className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Cloud Mode</span>
              </div>
            ) : (
              <div>
                <HardDrive className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Local Mode</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-gray-300 shrink-0" />

      <ScrollArea className="h-full w-full rounded-md">
        {sourceMode === 'cloud' ? (
          // CLOUD MODE SYNC - Simplified UI
          <div className="w-full space-y-6 p-1">
            {/* Simple Status Card */}
            <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
              <div className="space-y-4">
                {/* Status Display */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Cloud Sync Status</h2>
                    <p className="text-sm text-gray-600">
                      Automatic synchronization keeps your gallery up to date across devices
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {syncStatus?.isInSync ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg">
                        <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-green-700 font-medium">Up to date</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-lg">
                        <div className="h-3 w-3 bg-orange-500 rounded-full" />
                        <span className="text-orange-700 font-medium">Syncing...</span>
                      </div>
                    )}
                  </div>
                </div>

                {lastSyncTime && (
                  <div className="text-sm text-gray-600">
                    Last updated: {lastSyncTime.toLocaleString()}
                  </div>
                )}

                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Auto-refresh interval
                  </label>
                  <p className="text-sm text-gray-600 mb-3">
                    Choose how often to check for changes from cloud storage
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className={syncInterval === 'never' ? 'bg-blue-600 text-white' : ''}
                      size="sm"
                      onClick={() => {
                        if (autoSyncEnabled) {
                          setSyncInterval('never')
                          syncClient.stopAutoSync()
                          setAutoSyncEnabled(false)
                        }
                      }}
                    >
                      Never
                    </Button>
                    <Button
                      className={syncInterval === '30s' ? 'bg-blue-600 text-white' : ''}
                      size="sm"
                      onClick={() => {
                        if (!autoSyncEnabled || syncInterval !== '30s') {
                          syncClient.stopAutoSync()
                          setSyncInterval('30s')
                          syncClient.startAutoSync(30 * 1000)
                          setAutoSyncEnabled(true)
                        }
                      }}
                    >
                      Every 30 seconds
                    </Button>
                    <Button
                      className={syncInterval === '1m' ? 'bg-blue-600 text-white' : ''}
                      size="sm"
                      onClick={() => {

                        if (!autoSyncEnabled || syncInterval !== '1m') {
                          syncClient.stopAutoSync()
                          setSyncInterval('1m')
                          syncClient.startAutoSync(60 * 1000)
                          setAutoSyncEnabled(true)
                        }
                      }}
                    >
                      Every 1 minute
                    </Button>
                    <Button
                      className={syncInterval === '5m' ? 'bg-blue-600 text-white' : ''}
                      size="sm"
                      onClick={() => {
                        if (!autoSyncEnabled || syncInterval !== '5m') {
                          syncClient.stopAutoSync()
                          setSyncInterval('5m')
            
                          syncClient.startAutoSync(5 * 60 * 1000)
                          setAutoSyncEnabled(true)
                        }
                      }}
                    >
                      Every 5 minutes
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {autoSyncEnabled
                      ? '✓ Auto-refresh is enabled'
                      : 'Auto-refresh is disabled. Your gallery will only update when you navigate to it.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Advanced Details - Collapsible */}

          </div>
        ) : (
          // LOCAL MODE SYNC
          <Accordion
            type="multiple"
            defaultValue={['local-sync']}
            className="w-full space-y-6 p-1"
          >
            <AccordionItem
              value="local-sync"
              className="bg-white rounded-lg shadow-md border-none"
            >
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Local Mode Sync
                </h2>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 border-t border-gray-100 pt-4">
                {/* Local Sync Status */}
                <div className="mb-6">
                  <div className="flex justify-end mb-4">
                    <Button onClick={loadLocalSyncStatus} size="sm" className='hover:bg-gray-100 border border-gray-100'>
                      Refresh Status
                    </Button>
                  </div>

                  {localSyncStatus ? (
                    <div className="space-y-4 mb-6">
                      {/* Sync Status - Prominent Display */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border-2 border-blue-200">
                        <div className="text-sm text-gray-600 mb-2">Sync Status</div>
                        <div className="flex items-center gap-3">
                          {localSyncStatus.inSync ? (
                            <>
                              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                              <span className="text-2xl font-bold text-green-700">In Sync</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-6 w-6 text-orange-500" />
                              <span className="text-2xl font-bold text-orange-700">Out of Sync</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* UUID-Based Tracking */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white border-2 border-gray-200 p-4 rounded-lg">
                          <div className="text-sm text-gray-600 mb-2">Local Sync UUID</div>
                          {localSyncStatus.localUUID ? (
                            <div className="font-mono text-sm break-all text-blue-600">
                              {localSyncStatus.localUUID}
                            </div>
                          ) : (
                            <div className="text-gray-400 italic">Not synced yet</div>
                          )}
                        </div>
                        <div className="bg-white border-2 border-gray-200 p-4 rounded-lg">
                          <div className="text-sm text-gray-600 mb-2">Server Sync UUID</div>
                          {localSyncStatus.serverUUID ? (
                            <div className="font-mono text-sm break-all text-indigo-600">
                              {localSyncStatus.serverUUID}
                            </div>
                          ) : (
                            <div className="text-gray-400 italic">Not available</div>
                          )}
                        </div>
                      </div>

                      {/* Sequence Numbers - Secondary Info */}
                      <details className="group">
                        <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-2">
                          <span className="group-open:rotate-90 transition-transform">▶</span>
                          Show Sequence Numbers 
                        </summary>
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs text-gray-600 mb-1">Local Sequence</div>
                            <div className="text-xl font-bold">{localSyncStatus.localSeq}</div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs text-gray-600 mb-1">Server Sequence</div>
                            <div className="text-xl font-bold">{localSyncStatus.serverSeq}</div>
                          </div>
                        </div>
                      </details>
                    </div>
                  ) : (
                    <div className="text-gray-500 mb-6">Loading local sync status...</div>
                  )}
                </div>

                {/* Sync Controls */}
                <div className="space-y-4">
                  {/* Sync Button */}
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={handleLocalSync}
                      disabled={isSyncing}
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      <RefreshCw className={`mr-2 h-5 w-5 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Syncing...' : 'Sync with Cloud'}
                    </Button>
                  </div>

                  {/* Progress Display */}
                  {syncProgress && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                          <span className="font-medium text-blue-900">
                            {getPhaseDisplayName(syncProgress.phase)}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-blue-700">
                          {syncProgress.percentage}%
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${syncProgress.percentage}%` }}
                        />
                      </div>

                      {/* Progress Message */}
                      <p className="text-sm text-blue-800">
                        {syncProgress.message}
                      </p>

                      {/* Item Progress */}
                      {syncProgress.total > 0 && (
                        <p className="text-xs text-blue-600">
                          Processing: {syncProgress.current} / {syncProgress.total}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Sync Log Area */}
                  {localSyncLogs.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 text-sm">Sync Logs</h3>
                        <Button
                          onClick={() => setLocalSyncLogs([])}
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs hover:bg-gray-200"
                        >
                          Clear
                        </Button>
                      </div>
                      <ScrollArea className="h-64">
                        <div className="p-3 space-y-1">
                          {localSyncLogs.map((log, index) => (
                            <div
                              key={index}
                              className="font-mono text-xs text-gray-700 py-1 px-2 hover:bg-gray-100 rounded"
                            >
                              {log}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Info Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 hidden">
                    <h3 className="font-semibold mb-2 flex items-center gap-2 text-blue-900">
                      <AlertTriangle className="h-4 w-4 text-blue-600" />
                      Local Mode Sync
                    </h3>
                    <ul className="text-sm space-y-1 text-gray-700">
                      <li>• Syncs local storage with cloud using Last-Write-Wins strategy</li>
                      <li>• Uses UUID-based tracking to detect changes from any source</li>
                      <li>• Automatically handles uploads, downloads, and conflict resolution</li>
                      <li>• Progress shows real-time status of sync operations</li>
                      <li>• Server lock prevents concurrent modifications during sync</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </ScrollArea>
    </div>
  )
}