# Sync System Usage Guide

## Overview

The sync system provides Git-like synchronization between clients and the server. Every operation (upload, delete, update) gets a unique sequence number, similar to Git commits. This enables:

- ✅ Conflict detection and prevention
- ✅ Multi-device synchronization
- ✅ Full operation audit trail
- ✅ Offline operation queuing
- ✅ Automatic conflict resolution

## Quick Start

### 1. Initialize Sync on App Startup

```typescript
import { syncClient } from '@/services'

// In your main App component or initialization code
useEffect(() => {
  const initializeSync = async () => {
    try {
      // Sync with server to get latest operations
      await syncClient.initialize()

      // Start background auto-sync (optional but recommended)
      syncClient.startAutoSync(30000) // Every 30 seconds

      console.log('Sync initialized')
    } catch (error) {
      console.error('Failed to initialize sync:', error)
    }
  }

  initializeSync()

  // Cleanup on unmount
  return () => {
    syncClient.stopAutoSync()
  }
}, [])
```

### 2. Using Sync with Operations

#### Option A: Automatic Conflict Handling (Recommended)

Use the `withSyncRetry` helper to automatically handle 409 conflicts:

```typescript
import { withSyncRetry } from '@/utils/syncHelpers'
import { uploadImages, deleteImage } from '@/services'

// Upload with automatic conflict handling
const handleUpload = async (files: File[]) => {
  try {
    const result = await withSyncRetry(() => uploadImages(files))
    console.log('Upload successful:', result)
  } catch (error) {
    console.error('Upload failed:', error)
  }
}

// Delete with automatic conflict handling
const handleDelete = async (imageId: number) => {
  try {
    await withSyncRetry(() => deleteImage(imageId))
    console.log('Delete successful')
  } catch (error) {
    console.error('Delete failed:', error)
  }
}
```

#### Option B: Manual Conflict Handling

Handle 409 conflicts manually if you need custom logic:

```typescript
import { uploadImages } from '@/services'
import { syncClient } from '@/services'
import { isSyncConflictError } from '@/utils/syncHelpers'

const handleUpload = async (files: File[]) => {
  try {
    const result = await uploadImages(files)
    console.log('Upload successful:', result)
  } catch (error) {
    if (isSyncConflictError(error)) {
      console.log('Sync conflict detected. Syncing...')

      // Sync to get latest operations
      await syncClient.sync()

      // Retry the operation
      const result = await uploadImages(files)
      console.log('Upload successful after sync:', result)
    } else {
      throw error
    }
  }
}
```

### 3. Listening to Sync Events

Subscribe to sync events to update your UI:

```typescript
import { syncClient, SyncEvent } from '@/services'

useEffect(() => {
  const handleSyncEvent = (event: SyncEvent) => {
    switch (event.type) {
      case 'sync_started':
        console.log('Sync started')
        break
      case 'sync_completed':
        console.log('Sync completed:', event.data)
        // Refresh your data here
        break
      case 'sync_error':
        console.error('Sync error:', event.data)
        break
      case 'operation_applied':
        console.log('Operation applied:', event.data)
        break
      case 'conflict_detected':
        console.log('Conflict detected:', event.data)
        break
    }
  }

  syncClient.addEventListener(handleSyncEvent)

  return () => {
    syncClient.removeEventListener(handleSyncEvent)
  }
}, [])
```

### 4. Listening to Specific Operation Events

The sync client emits custom window events for specific operations:

```typescript
useEffect(() => {
  // Listen for image uploads from other clients
  const handleImageUploaded = (event: CustomEvent) => {
    console.log('Image uploaded:', event.detail)
    // Refresh gallery or update UI
    refreshGallery()
  }

  // Listen for image deletions
  const handleImageDeleted = (event: CustomEvent) => {
    console.log('Image deleted:', event.detail)
    // Remove from UI
    removeImageFromUI(event.detail.imageId)
  }

  window.addEventListener('sync:image-uploaded', handleImageUploaded)
  window.addEventListener('sync:image-deleted', handleImageDeleted)

  return () => {
    window.removeEventListener('sync:image-uploaded', handleImageUploaded)
    window.removeEventListener('sync:image-deleted', handleImageDeleted)
  }
}, [])
```

Available events:
- `sync:image-uploaded` - New image uploaded
- `sync:image-deleted` - Image deleted
- `sync:image-updated` - Image metadata updated
- `sync:image-replaced` - Image file replaced
- `sync:batch-operation` - Batch operation performed

## API Reference

### syncClient

Main sync client singleton instance.

#### Methods

##### `getClientId(): string`
Get the unique client ID.

##### `getLastSyncSequence(): number`
Get the last known sync sequence number.

##### `updateLastSyncSequence(sequence: number): void`
Update the last sync sequence (automatically called by API interceptor).

##### `getSyncHeaders(): Record<string, string>`
Get headers to include in requests (automatically added by API interceptor).

##### `sync(): Promise<void>`
Manually sync with server to fetch and apply all operations since last sync.

##### `checkSyncStatus(): Promise<SyncStatus>`
Check if client is in sync with server.

##### `startAutoSync(intervalMs?: number): void`
Start automatic background sync. Default interval: 30 seconds.

##### `stopAutoSync(): void`
Stop automatic background sync.

##### `initialize(): Promise<void>`
Perform initial sync on app startup.

##### `reset(): void`
Reset sync state (sets sequence to 0).

##### `addEventListener(listener: SyncEventListener): void`
Add event listener for sync events.

##### `removeEventListener(listener: SyncEventListener): void`
Remove event listener.

### Sync Helper Functions

#### `withSyncRetry<T>(operation: () => Promise<T>, maxRetries?: number): Promise<T>`
Wrapper for operations that automatically handles 409 conflicts by syncing and retrying.

#### `withRefresh<T>(operation: () => Promise<T>, onSuccess?: (result: T) => void): Promise<T>`
Wrapper that triggers a data refresh after successful operation.

#### `isSyncConflictError(error: any): boolean`
Check if an error is a sync conflict (409) error.

#### `getOperationsBehind(error: any): number | undefined`
Extract the number of operations behind from a conflict error.

## How It Works

### The Clock Mechanism

Think of it like Git commits - every operation gets a sequence number:

```
Sequence | Operation    | Client   | Image
---------|-------------|----------|--------
1        | upload      | Desktop  | photo.jpg
2        | delete      | Mobile   | cat.jpg
3        | update      | Desktop  | photo.jpg
4        | batch_upload| Desktop  | (parent)
5        | upload      | Desktop  | sunset.jpg (child of 4)
```

### Conflict Detection

**Fast-forward (ACCEPT):**
- Client: "I'm at sequence 100"
- Server: "I'm also at 100"
- → ACCEPT operation ✓
- → New sequence: 101

**Behind server (REJECT):**
- Client: "I'm at sequence 100"
- Server: "I'm at 103"
- → REJECT with 409 Conflict ✗
- → Client must sync first (get operations 101-103)

### API Integration

The sync system is automatically integrated into the API layer:

1. **Request Interceptor**: Adds `X-Client-ID` and `X-Last-Sync-Sequence` headers to all write operations (POST, PUT, DELETE, PATCH)

2. **Response Interceptor**:
   - Updates `lastSyncSequence` from `X-Current-Sequence` header
   - Handles 409 conflicts with detailed error info

This means you don't need to manually add sync headers - they're added automatically!

## Best Practices

### ✅ DO:
- Initialize sync on app startup
- Enable auto-sync for real-time updates
- Use `withSyncRetry` for all write operations
- Listen to sync events to update UI
- Check sync status before critical operations

### ❌ DON'T:
- Don't manually modify sequence numbers
- Don't disable auto-sync unless you have a good reason
- Don't ignore 409 errors - they mean your data is stale
- Don't sync too frequently (< 10 seconds) - it wastes resources

## Example: Complete Integration

```typescript
import { useEffect, useState } from 'react'
import { syncClient } from '@/services'
import { withSyncRetry } from '@/utils/syncHelpers'
import { uploadImages, deleteImage } from '@/services'

function MyComponent() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null)

  // Initialize sync on mount
  useEffect(() => {
    const init = async () => {
      await syncClient.initialize()
      syncClient.startAutoSync()
      updateSyncStatus()
    }
    init()

    return () => syncClient.stopAutoSync()
  }, [])

  // Listen to sync events
  useEffect(() => {
    const handleSyncEvent = (event) => {
      if (event.type === 'sync_started') {
        setIsSyncing(true)
      } else if (event.type === 'sync_completed') {
        setIsSyncing(false)
        updateSyncStatus()
      }
    }

    syncClient.addEventListener(handleSyncEvent)
    return () => syncClient.removeEventListener(handleSyncEvent)
  }, [])

  const updateSyncStatus = async () => {
    const status = await syncClient.checkSyncStatus()
    setSyncStatus(status)
  }

  const handleUpload = async (files) => {
    try {
      await withSyncRetry(() => uploadImages(files))
      alert('Upload successful!')
    } catch (error) {
      alert('Upload failed: ' + error.message)
    }
  }

  return (
    <div>
      {isSyncing && <div>Syncing...</div>}
      {syncStatus && (
        <div>
          {syncStatus.isInSync ? '✓ In Sync' : `⚠ Behind by ${syncStatus.operationsBehind}`}
        </div>
      )}
      <button onClick={() => handleUpload([...files])}>Upload</button>
    </div>
  )
}
```

## Troubleshooting

### Issue: Getting 409 errors frequently
**Solution**: Make sure auto-sync is enabled or manually sync more often.

### Issue: Operations not syncing
**Solution**: Check that sync headers are being sent (check network tab in dev tools).

### Issue: Sync conflicts on every operation
**Solution**: Check if multiple clients are using the same client ID (they shouldn't be).

### Issue: High network usage
**Solution**: Reduce auto-sync frequency or disable it when not needed.

## More Information

- See `/src/pages/Sync.tsx` for a complete sync management UI
- See `/src/services/syncClient.ts` for implementation details
- See `/src/utils/syncHelpers.ts` for helper utilities
