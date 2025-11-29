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
    inSync: boolean
  } | null>(null)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)

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
      localSyncService.setProgressCallback((progress: SyncProgress) => {
        setSyncProgress(progress)
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
    try {
      const result = await localSyncService.syncLWW()
      if (result.success) {
        alert(`Sync successful! ${result.message}`)
        await loadLocalSyncStatus()
      } else {
        alert(`Sync failed: ${result.message}`)
      }
    } catch (error) {
      console.error('Sync failed:', error)
      alert('Sync failed. Check console for details.')
    } finally {
      setIsSyncing(false)
      setSyncProgress(null)
    }
  }

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

  return (
    <div className="w-full flex flex-col px-6 py-6 h-full gap-6 bg-white">
      <div className="space-y-3 shrink-0">
        <HomeLink />
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-4xl font-bold font-sans text-gray-900">Sync</h1>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
            {sourceMode === 'cloud' ? (
              <>
                <Cloud className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Cloud Mode</span>
              </>
            ) : (
              <>
                <HardDrive className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Local Mode</span>
              </>
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
                    Choose how often to check for changes from other devices
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={!autoSyncEnabled ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        if (autoSyncEnabled) {
                          syncClient.stopAutoSync()
                          setAutoSyncEnabled(false)
                        }
                      }}
                    >
                      Never
                    </Button>
                    <Button
                      variant={autoSyncEnabled ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        if (!autoSyncEnabled) {
                          syncClient.startAutoSync(30000)
                          setAutoSyncEnabled(true)
                        }
                      }}
                    >
                      Every 30 seconds
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        syncClient.stopAutoSync()
                        syncClient.startAutoSync(60000)
                        setAutoSyncEnabled(true)
                      }}
                    >
                      Every 1 minute
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        syncClient.stopAutoSync()
                        syncClient.startAutoSync(300000)
                        setAutoSyncEnabled(true)
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
            <Accordion type="multiple" className="w-full">
              <AccordionItem
                value="advanced"
                className="bg-white rounded-lg shadow-md border-none"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <h2 className="text-lg font-semibold text-gray-600">Advanced Details</h2>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-6">
                  {/* Status Details */}
                  <div>
                    <h3 className="font-medium mb-3">Sync Status Details</h3>
                    <div className="flex justify-end mb-4">
                      <Button onClick={loadSyncStatus} variant="outline" size="sm">
                        Refresh Status
                      </Button>
                    </div>
                    {syncStatus ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm text-gray-600 mb-1">Client ID</div>
                          <div
                            className="font-mono text-sm truncate"
                            title={syncClient.getClientId()}
                          >
                            {syncClient.getClientId().substring(0, 20)}...
                          </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm text-gray-600 mb-1">
                            Server Sequence
                          </div>
                          <div className="text-2xl font-bold">
                            {syncStatus.currentSequence}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm text-gray-600 mb-1">
                            Client Sequence
                          </div>
                          <div className="text-2xl font-bold">
                            {syncClient.getLastSyncSequence()}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm text-gray-600 mb-1">Status</div>
                          <div className="flex items-center gap-2">
                            {syncStatus.isInSync ? (
                              <span className="text-green-600 font-semibold">
                                ✓ In Sync
                              </span>
                            ) : (
                              <span className="text-orange-600 font-semibold">
                                ⚠ Behind by {syncStatus.operationsBehind}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-500">Loading status...</div>
                    )}
                  </div>

                  {/* Debug Controls */}
                  <div>
                    <h3 className="font-medium mb-3">Debug Controls</h3>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        variant="outline"
                        size="sm"
                      >
                        {isSyncing ? '🔄 Syncing...' : '🔄 Manual Sync'}
                      </Button>
                      <Button
                        onClick={handleInitialize}
                        disabled={isLoading}
                        variant="outline"
                        size="sm"
                      >
                        {isLoading ? 'Initializing...' : '🚀 Initialize'}
                      </Button>
                      <Button onClick={handleResetSync} variant="outline" size="sm">
                        🔄 Reset Sync State
                      </Button>
                    </div>
                  </div>

                  {/* Recent Sync Events */}
                  <div>
                    <h3 className="font-medium mb-3">Recent Sync Events</h3>
                    {syncEvents.length > 0 ? (
                      <div className="bg-gray-900 text-green-400 font-mono text-xs p-4 rounded-lg max-h-64 overflow-y-auto">
                        {syncEvents.map((event, index) => (
                          <div key={index} className="mb-1">
                            {event}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm">
                        No events yet. Perform a sync to see events.
                      </div>
                    )}
                  </div>

                  {/* My Operations */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">My Recent Operations</h3>
                      <Button onClick={loadMyOperations} variant="outline" size="sm">
                        Refresh List
                      </Button>
                    </div>
                    {myOperations.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-3 text-sm font-semibold">
                                Seq
                              </th>
                              <th className="text-left py-2 px-3 text-sm font-semibold">
                                Operation
                              </th>
                              <th className="text-left py-2 px-3 text-sm font-semibold">
                                Image UUID
                              </th>
                              <th className="text-left py-2 px-3 text-sm font-semibold">
                                Time
                              </th>
                              <th className="text-left py-2 px-3 text-sm font-semibold">
                                Metadata
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {myOperations.map((op) => (
                              <tr key={op.id} className="border-b hover:bg-gray-50">
                                <td className="py-2 px-3 font-mono text-sm">
                                  {op.sequenceNumber}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="text-lg mr-2">
                                    {getOperationIcon(op.operation)}
                                  </span>
                                  <span className="text-sm">{op.operation}</span>
                                </td>
                                <td className="py-2 px-3 font-mono text-xs">
                                  {op.imageUuid
                                    ? op.imageUuid.substring(0, 8)
                                    : '-'}
                                </td>
                                <td className="py-2 px-3 text-sm">
                                  {new Date(op.createdAt).toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-xs text-gray-600">
                                  {Object.keys(op.metadata || {}).length > 0
                                    ? JSON.stringify(op.metadata).substring(0, 50) +
                                      '...'
                                    : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm">
                        No operations found for your client.
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
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
                    <Button onClick={loadLocalSyncStatus} variant="outline" size="sm">
                      Refresh Status
                    </Button>
                  </div>

                  {localSyncStatus ? (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600 mb-1">Local Sequence</div>
                        <div className="text-2xl font-bold">{localSyncStatus.localSeq}</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600 mb-1">Server Sequence</div>
                        <div className="text-2xl font-bold">{localSyncStatus.serverSeq}</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600 mb-1">Sync Status</div>
                        <div className="flex items-center gap-2">
                          {localSyncStatus.inSync ? (
                            <span className="text-green-600 font-semibold">✓ In Sync</span>
                          ) : (
                            <span className="text-orange-600 font-semibold flex items-center gap-1">
                              <AlertTriangle className="h-4 w-4" />
                              Out of Sync
                            </span>
                          )}
                        </div>
                      </div>
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
                      className="bg-blue-600 hover:bg-blue-700"
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

                  {/* Info Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold mb-2 flex items-center gap-2 text-blue-900">
                      <AlertTriangle className="h-4 w-4 text-blue-600" />
                      Local Mode Sync
                    </h3>
                    <ul className="text-sm space-y-1 text-gray-700">
                      <li>• Syncs local storage with cloud using Last-Write-Wins strategy</li>
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