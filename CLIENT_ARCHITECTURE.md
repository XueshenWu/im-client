# Client Architecture: Local and Cloud Mode

## Table of Contents
1. [Overview](#overview)
2. [Operating Modes](#operating-modes)
3. [Cloud Mode](#cloud-mode)
4. [Local Mode](#local-mode)
5. [Server Communication](#server-communication)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Data Flow Diagrams](#data-flow-diagrams)
8. [Key Files Reference](#key-files-reference)

---

## Overview

The application uses a **hybrid architecture** supporting two operational modes:
- **Cloud Mode**: Direct server communication for all operations (online-only)
- **Local Mode**: Local SQLite database with manual push/pull synchronization (offline-capable)

The mode is controlled via `useSettingsStore().sourceMode` and components conditionally render based on the selected mode.

---

## Operating Modes

### Mode Selection
- **Store**: `src/stores/settingsStore.ts`
- **UI**: `src/components/settings/SourceModeSettings.tsx`
- **Type**: `'cloud' | 'local'` (default: `'cloud'`)
- **Persistence**: localStorage via Zustand

### Mode Switching Behavior
```typescript
// Before switching to cloud mode
await syncService.getSyncStatus() // Validates cloud availability
if (error) {
  alert('Cloud unavailable')
  return // Stay in local mode
}
setSourceMode('cloud')
```

---

## Cloud Mode

### How Cloud Mode Works
- All data lives on the server
- Every operation is an immediate API call
- No local persistence (except temporary caching)
- Real-time sync via automatic polling

### Why Cloud Mode Has Auto-Sync

**Purpose**: Multi-device/multi-client synchronization

Cloud mode sync enables **real-time collaboration** across multiple devices/users:

**Scenario Without Sync**:
```
User A (Desktop 1)  →  Upload image  →  Server
User B (Desktop 2)  →  ??? How does B see the new image? ???
```

**Scenario With Sync** (Current Implementation):
```
User A uploads image
    ↓
Server increments sequence: 100 → 101
    ↓
User B's auto-sync (30s later)
    ↓
GET /api/sync/operations?since=100
    ↓
Response: [{ type: 'image-uploaded', ... }]
    ↓
User B's gallery automatically shows new image
```

**Real-World Use Cases**:
1. **Team Collaboration**: Multiple users managing same image library
2. **Multi-Device Single User**: Work PC + Home PC stay synchronized
3. **Web + Desktop**: Changes on one reflect on the other within 30 seconds
4. **Conflict Detection**: Server detects when client is out of sync (409 response)

**Why Sequence-Based Sync is Efficient**:
- Without sync: Fetch ALL images every 30s (wasteful)
- With sync: Fetch only operations since last known sequence (efficient)

Example:
```
Naive: GET /api/images (1000 images × 30s = massive bandwidth)
Smart: GET /api/sync/operations?since=150 (only 5 new operations)
```

**Local Mode Doesn't Need This Because**:
- Single-device only (local SQLite database)
- No other clients can modify data
- Push/pull is manual and intentional
- Think: "Cloud mode = Git with auto-pull, Local mode = Git with manual pull"

### When Cloud Mode Communicates with Server

#### 1. **Always** - Every Action
Cloud mode **ALWAYS** communicates with the server for:
- Fetching images (gallery view)
- Uploading images
- Deleting images
- Updating metadata
- Searching images
- Getting statistics

#### 2. **Background** - Automatic Sync
- Polls `/api/sync/operations` every 30 seconds (configurable)
- Checks for new operations from other clients
- Updates `X-Current-Sequence` from response headers

#### 3. **Sequence Tracking** - Non-Blocking
- Server returns `X-Current-Sequence` header on all responses
- Server includes `X-Operations-Behind` when client is behind
- **No 409 Conflict blocking** - operations always succeed
- Client monitors headers and syncs in background

### Cloud Mode API Usage

#### Image Operations
```typescript
// Gallery View
GET /api/images?limit=20&cursor={cursor}&sortBy={field}&sortOrder={asc|desc}
// Headers: X-Client-ID, X-Last-Sync-Sequence
// Response Headers: X-Current-Sequence

// Upload (< 50MB)
POST /api/images/upload
Content-Type: multipart/form-data
Body: files[]

// Upload (≥ 50MB - Chunked)
POST /api/images/chunked/init
POST /api/images/chunked/upload/{sessionId} (repeat for each 5MB chunk)
POST /api/images/chunked/complete/{sessionId}

// Download Image
GET /api/images/{uuid}/file?info=true
Response Headers: x-image-original-name, x-image-file-size, x-image-format

// Delete
DELETE /api/images/{id}
POST /api/images/batch/delete/uuids
Body: { uuids: string[] }

// Update Metadata
PUT /api/images/{id}
Body: { filename?, tags?, collectionId?, exifData? }
```

#### Sync Operations
```typescript
// Get Current Sequence
GET /api/sync/current
Response: { sequence: number }

// Get Operations Since
GET /api/sync/operations?since={sequence}&limit=100
Response: {
  operations: SyncOperation[],
  hasMore: boolean,
  nextSequence: number
}

// Check Sync Status
GET /api/sync/status
Response: {
  currentSequence: number,
  clientLastSequence: number,
  operationsBehind: number,
  isInSync: boolean
}

// Get My Operations
GET /api/sync/my-operations?limit=50
Response: { operations: SyncOperation[] }
```

### Cloud Mode Request Headers
All requests include:
```
X-Client-ID: desktop-app-v1.0-{deviceHash}
X-Last-Sync-Sequence: {lastKnownSequence}
```

### Cloud Mode Response Headers
Server should return:
```
X-Current-Sequence: {latestSequenceNumber}
```

Client updates `lastSyncSequence` in localStorage after every response.

---

## Local Mode

### How Local Mode Works
- All data lives in local SQLite database (`AppData/image-management/local.db`)
- Image files stored in `AppData/image-management/images/`
- Thumbnails stored in `AppData/image-management/thumbnails/`
- **Completely offline-capable** - no server needed for daily operations
- Server communication **ONLY** during manual push/pull sync

### When Local Mode Communicates with Server

#### 1. **Manual Push** - Upload Local Changes
User clicks "Push to Cloud" → Client calls:
```typescript
// 1. Check sync status
GET /api/sync/status

// 2. Get remote images for diff
GET /api/images?all=true

// 3. Upload new images
POST /api/images/upload (for each new image)

// 4. Update remote metadata
PUT /api/images/uuid/{uuid} (for changed images)

// 5. Get new sequence
GET /api/sync/current

// 6. Update local sync metadata
// (No server call - updates SQLite sync_metadata table)
```

#### 2. **Manual Pull** - Download Remote Changes
User clicks "Pull from Cloud" → Client calls:
```typescript
// 1. Get local images
// (No server call - reads from SQLite)

// 2. Get remote images
GET /api/images?all=true&includeExif=true

// 3. Download new images
GET {image.filePath} (raw file URL, e.g., /uploads/images/{filename})
GET {image.thumbnailPath} (raw file URL, e.g., /uploads/thumbnails/{filename})

// 4. Update local database
// (No server call - updates SQLite)

// 5. Get new sequence
GET /api/sync/current

// 6. Update local sync metadata
// (No server call - updates SQLite)
```

#### 3. **Auto Sync** (if enabled)
Runs push → pull sequence on interval (30s, 1m, 5m, 10m, 30m):
```typescript
// 1. Try push first
await localSyncService.push()

// 2. If push fails (conflicts), pull first
if (error) {
  await localSyncService.pull()
  await localSyncService.push() // Retry
}
```

#### 4. **Mode Switching**
When switching from local → cloud:
```typescript
// Validate cloud availability
GET /api/sync/status
```

### Local Mode API Usage

Local mode **does NOT** use most image APIs. It only calls:

#### Sync Status Check
```typescript
GET /api/sync/status
Response: {
  currentSequence: number,
  clientLastSequence: number, // From X-Last-Sync-Sequence header
  isInSync: boolean
}
```

#### Get All Remote Images (for diff)
```typescript
GET /api/images?all=true&includeExif=true
Response: { images: Image[] }
```

#### Upload New Images (during push)
```typescript
POST /api/images/upload
Content-Type: multipart/form-data
Body: files[]
```

#### Update Remote Metadata (during push)
```typescript
PUT /api/images/uuid/{uuid}
Body: { filename, tags, collectionId, etc }
```

#### Download Image Files (during pull)
```typescript
// Direct file access - NO API endpoint
GET {baseURL}{image.filePath}
GET {baseURL}{image.thumbnailPath}

// Example:
GET http://localhost:3000/uploads/images/abc123.jpg
GET http://localhost:3000/uploads/thumbnails/abc123.jpg
```

### Local Mode Electron API
Local operations use Electron IPC instead of HTTP:

```typescript
// Database Operations (via window.electronAPI.db)
db.initialize()
db.getAllImages()
db.getImageByUuid(uuid)
db.getPaginatedImages(page, pageSize, sortBy, sortOrder)
db.insertImage(image)
db.insertImages(images[])
db.updateImage(uuid, updates)
db.deleteImage(uuid)
db.deleteImages(uuids[])
db.searchImages(query)
db.getSyncMetadata() // { lastSyncSequence, lastSyncTime }
db.updateSyncMetadata({ lastSyncSequence, lastSyncTime })

// File Operations
readLocalFile(path) // Returns ArrayBuffer
saveImageBuffer(fileName, buffer)
saveThumbnailBuffer(fileName, buffer)
getLocalImages(options)

// Export
selectDirectory() // Returns path
exportImages(images[], destination)
```

---

## Server Communication

### Communication Patterns Summary

| Operation | Cloud Mode | Local Mode |
|-----------|------------|-----------|
| **View Gallery** | GET /api/images | SQLite query (no server) |
| **Upload Image** | POST /api/images/upload | SQLite insert (no server) |
| **Delete Image** | DELETE /api/images/{id} | SQLite delete (no server) |
| **Update Metadata** | PUT /api/images/{id} | SQLite update (no server) |
| **Search** | GET /api/images?search={q} | SQLite LIKE query (no server) |
| **Sync** | Auto every 30s | Manual push/pull only |
| **Download Files** | GET /api/images/{uuid}/file | Direct file URL during pull |

### Sequence Tracking

#### Cloud Mode
```
Client                        Server
  |                              |
  |  GET /api/images             |
  |  X-Last-Sync-Sequence: 100   |
  |----------------------------->|
  |                              |
  |  200 OK                      |
  |  X-Current-Sequence: 105     |
  |<-----------------------------|
  |                              |
  | Update localStorage: 105     |
  |                              |
```

Server increments sequence on:
- Image upload
- Image delete
- Image update
- Image replace
- Batch operations

#### Local Mode
```
Client                        Server
  |                              |
  |  Manual Sync Triggered       |
  |                              |
  |  GET /api/sync/status        |
  |  X-Last-Sync-Sequence: 50    |
  |----------------------------->|
  |                              |
  |  200 OK                      |
  |  currentSequence: 100        |
  |  isInSync: false             |
  |<-----------------------------|
  |                              |
  |  Calculate diff (50 ops behind) |
  |  Pull changes...             |
  |  Update SQLite: lastSeq=100  |
  |                              |
```

### Conflict Handling

#### Cloud Mode - 409 Conflict Response
```typescript
// Server detects client is behind
Response: 409 Conflict
Body: {
  error: 'SEQUENCE_CONFLICT',
  message: 'Client sequence is outdated',
  currentSequence: 150,
  clientSequence: 100
}

// Client auto-syncs
syncClient.handleConflict()
  → getSyncOperations(since: 100)
  → Apply operations 101-150
  → Update lastSyncSequence to 150
```

#### Local Mode - Manual Resolution
```typescript
// Push fails if remote has changes
if (!stateDiffService.canFastForwardPush()) {
  alert('Remote has changes. Pull first.')
  return
}

// Force push option available
if (user confirms force push) {
  // Upload all local images, overwriting remote
}
```

---

## API Endpoints Reference

### Required for Cloud Mode

| Method | Endpoint | Purpose | Headers | Response Headers |
|--------|----------|---------|---------|------------------|
| GET | `/api/images` | Fetch images with pagination | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| GET | `/api/images/:id` | Get single image by DB ID | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| GET | `/api/images/uuid/:uuid` | Get single image by UUID | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| GET | `/api/images/stats` | Get image statistics | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| POST | `/api/images/upload` | Upload images (multipart) | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| POST | `/api/images/batch` | Batch upload with config | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| PUT | `/api/images/:id` | Update image metadata | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| DELETE | `/api/images/:id` | Delete single image (soft) | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| POST | `/api/images/batch/delete/ids` | Batch delete by IDs | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| POST | `/api/images/batch/delete/uuids` | Batch delete by UUIDs | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| PUT | `/api/images/uuid/:uuid/replace` | Replace image file | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| GET | `/api/images/:uuid/file` | Download image file | - | x-image-original-name, x-image-file-size, x-image-format |
| POST | `/api/images/chunked/init` | Initialize chunked upload | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| POST | `/api/images/chunked/upload/:sessionId` | Upload chunk | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| POST | `/api/images/chunked/complete/:sessionId` | Complete chunked upload | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| GET | `/api/images/chunked/status/:sessionId` | Get upload status | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| DELETE | `/api/images/chunked/:sessionId` | Cancel chunked upload | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| GET | `/api/sync/current` | Get current sequence | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| GET | `/api/sync/operations` | Get operations since sequence | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| GET | `/api/sync/status` | Get sync status | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| GET | `/api/sync/my-operations` | Get my recent operations | X-Client-ID, X-Last-Sync-Sequence | X-Current-Sequence |
| GET | `/api/health` | Health check | - | - |

### Required for Local Mode

| Method | Endpoint | Purpose | When Used |
|--------|----------|---------|-----------|
| GET | `/api/images?all=true&includeExif=true` | Get all images for diff | During pull sync |
| GET | `/api/sync/status` | Check if in sync | Before push, on mode switch |
| GET | `/api/sync/current` | Get latest sequence | After push/pull |
| POST | `/api/images/upload` | Upload new images | During push |
| PUT | `/api/images/uuid/:uuid` | Update metadata | During push |
| GET | `{filePath}` | Download image file | During pull (raw file access) |
| GET | `{thumbnailPath}` | Download thumbnail | During pull (raw file access) |

### Optional for Both Modes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Check server availability |

---

## Data Flow Diagrams

### Cloud Mode - Upload Flow
```
┌──────────────────┐
│ User Selects     │
│ Files            │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Check File Size  │
│ < 50MB or ≥ 50MB?│
└────┬────────┬────┘
     │        │
     │        │ ≥ 50MB
     │        ▼
     │   ┌────────────────────┐
     │   │ Chunked Upload     │
     │   │ 1. init            │
     │   │ 2. upload chunks   │
     │   │ 3. complete        │
     │   └─────────┬──────────┘
     │             │
     │ < 50MB      │
     ▼             ▼
┌──────────────────────────────┐
│ POST /api/images/upload      │
│ Headers:                     │
│   X-Client-ID                │
│   X-Last-Sync-Sequence       │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Server Response              │
│ Headers:                     │
│   X-Current-Sequence: N+1    │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Update localStorage          │
│ lastSyncSequence = N+1       │
└──────────────────────────────┘
```

### Cloud Mode - Sync Flow
```
┌──────────────────┐
│ Auto Sync Timer  │
│ (every 30s)      │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│ GET /api/sync/operations?    │
│   since={lastSyncSequence}   │
│   limit=100                  │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Response:                    │
│ {                            │
│   operations: [],            │
│   hasMore: boolean,          │
│   nextSequence: number       │
│ }                            │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Apply Each Operation:        │
│ - image-uploaded             │
│ - image-deleted              │
│ - image-updated              │
│ - image-replaced             │
│ - batch-operation            │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Update lastSyncSequence      │
│ Emit sync_completed event    │
└──────────────────────────────┘
```

### Local Mode - Push Flow
```
┌──────────────────┐
│ User Clicks      │
│ "Push to Cloud"  │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│ GET /api/sync/status         │
│ Check: isInSync?             │
└────┬──────────────────┬──────┘
     │                  │
     │ Not in sync      │ In sync
     ▼                  ▼
┌─────────────┐   ┌──────────────────┐
│ Alert user  │   │ Calculate diff   │
│ "Pull first"│   │ (stateDiffService)│
└─────────────┘   └────────┬─────────┘
                           │
                           ▼
┌──────────────────────────────────────┐
│ Diff Results:                        │
│ - toUpload: local-only images        │
│ - toUpdate: metadata changes         │
│ - toReplace: content changes (ABORT) │
│ - toDelete: remote-only (ABORT)      │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────┐
│ Upload new images            │
│ POST /api/images/upload      │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Update remote metadata       │
│ PUT /api/images/uuid/{uuid}  │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ GET /api/sync/current        │
│ Get new sequence             │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Update SQLite sync_metadata  │
│ lastSyncSequence = newSeq    │
│ lastSyncTime = now           │
└──────────────────────────────┘
```

### Local Mode - Pull Flow
```
┌──────────────────┐
│ User Clicks      │
│ "Pull from Cloud"│
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│ Get Local Images             │
│ db.getAllImages()            │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Get Remote Images            │
│ GET /api/images?all=true     │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Calculate Diff               │
│ (stateDiffService)           │
│ - toDownload (new)           │
│ - toReplace (changed)        │
│ - toUpdate (metadata)        │
│ - toDelete (removed)         │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Show Export Dialog           │
│ (if affected images exist)   │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Download New Images          │
│ GET {baseURL}{filePath}      │
│ GET {baseURL}{thumbnailPath} │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Save to AppData              │
│ saveImageBuffer()            │
│ saveThumbnailBuffer()        │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Update SQLite Database       │
│ - insertImages(new)          │
│ - updateImage(changed)       │
│ - deleteImages(removed)      │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│ Update Sync Metadata         │
│ lastSyncSequence = current   │
└──────────────────────────────┘
```

---

## Key Files Reference

### API & Server Communication
| File | Purpose |
|------|---------|
| `src/services/api.ts` | Axios instance, request/response interceptors, sync headers |
| `src/services/images.service.ts` | Image CRUD, upload, chunked upload, delete |
| `src/services/sync.service.ts` | Sync API endpoints (operations, status, current) |
| `src/services/health.service.ts` | Health check endpoint |

### Cloud Mode
| File | Purpose |
|------|---------|
| `src/services/syncClient.ts` | Main sync engine, auto-sync, conflict handling, event system |
| `src/components/gallery/CloudPhotoWall.tsx` | Cloud gallery with selection & bulk ops |
| `src/components/gallery/CloudPhotoCard.tsx` | Cloud photo card with context menu |
| `src/components/gallery/DetailList.tsx` | Cloud table view |

### Local Mode
| File | Purpose |
|------|---------|
| `src/services/localDatabase.service.ts` | Wrapper for Electron DB API |
| `src/services/localImage.service.ts` | Local image operations (CRUD) |
| `src/services/localSync.service.ts` | Push/pull sync logic |
| `src/services/stateDiff.service.ts` | Diff calculation & conflict detection |
| `src/components/gallery/LocalPhotoWall.tsx` | Local gallery with selection & bulk ops |
| `src/components/gallery/LocalPhotoCard.tsx` | Local photo card with context menu |
| `src/components/gallery/LocalDetailList.tsx` | Local table view |

### Electron
| File | Purpose |
|------|---------|
| `electron/preload.ts` | IPC bridge exposing window.electronAPI |
| `electron/main.ts` | Main process, IPC handlers, window management |
| `electron/database.ts` | SQLite wrapper (images + sync_metadata tables) |

### State & Settings
| File | Purpose |
|------|---------|
| `src/stores/settingsStore.ts` | Source mode, sync policy settings |
| `src/stores/imageViewerStore.ts` | Image viewer state |
| `src/stores/galleryRefreshStore.ts` | Gallery refresh trigger |

### UI Components
| File | Purpose |
|------|---------|
| `src/components/settings/SourceModeSettings.tsx` | Mode selection UI |
| `src/components/gallery/HybridPhotoWall.tsx` | Conditional gallery renderer |
| `src/pages/Sync.tsx` | Sync control panel (different UI per mode) |
| `src/pages/Gallery.tsx` | Main gallery page |

### Types
| File | Purpose |
|------|---------|
| `src/types/api.ts` | API request/response types |
| `src/types/local.ts` | LocalImage, SourceMode types |
| `src/types/gallery.ts` | ImageItem, ImageSource types |

---

## Important Notes for Backend

### 1. Sequence Management
- Server MUST increment sequence on every state change
- Server MUST return `X-Current-Sequence` header on ALL responses
- Server MUST accept `X-Last-Sync-Sequence` header to detect conflicts
- Return 409 Conflict if client sequence is outdated

### 2. Client ID
- Client sends `X-Client-ID` header on all requests
- Format: `desktop-app-v1.0-{deviceHash}` (desktop) or `web-app-v1.0-{uuid}` (web)
- Used to filter "my operations" in sync

### 3. File URLs
Local mode expects **direct file access** during pull:
```
GET http://localhost:3000/uploads/images/abc123.jpg
GET http://localhost:3000/uploads/thumbnails/abc123.jpg
```
These are NOT API endpoints - they're static file paths stored in `image.filePath` and `image.thumbnailPath`.

### 4. Chunked Upload
- Triggered automatically for files ≥ 50MB
- Chunk size: 5MB
- Session-based with unique sessionId
- Must support resume/cancel

### 5. Soft Delete
- `DELETE /api/images/{id}` should be a **soft delete** (set deletedAt)
- Hard delete should be a separate admin operation
- Sync operations track deletions

### 6. CORS & Static Files
For local mode to work, server must:
- Allow CORS for file downloads
- Serve `/uploads/images/` and `/uploads/thumbnails/` as static directories
- Include proper headers for image downloads (original-name, file-size, format)

### 7. Batch Operations
Both modes use batch operations:
- Cloud: POST `/api/images/batch/delete/uuids` with `{ uuids: string[] }`
- Local: Multiple single operations during push

---

## Testing Checklist for Backend

### Cloud Mode Tests
- [ ] Upload single image, verify sequence increments
- [ ] Upload multiple images, verify batch sequence
- [ ] Delete image, verify sequence increments
- [ ] Update metadata, verify sequence increments
- [ ] Chunked upload for 100MB file
- [ ] Auto-sync polling (mock 2 clients)
- [ ] 409 conflict when client is behind
- [ ] X-Current-Sequence in all responses

### Local Mode Tests
- [ ] Push: Upload new images to empty server
- [ ] Push: Update metadata for existing images
- [ ] Push: Fail when remote has changes (isInSync = false)
- [ ] Pull: Download new images from server
- [ ] Pull: Replace images with different content
- [ ] Pull: Delete local images removed from server
- [ ] Pull: Update metadata for changed images
- [ ] Direct file access: GET /uploads/images/abc.jpg works
- [ ] Sync sequence updates after push/pull

### General Tests
- [ ] Health check returns database status
- [ ] Client-ID header present in all requests
- [ ] Sequence tracking works across sessions
- [ ] Mode switching validates cloud availability

---

**Document Version**: 1.0
**Last Updated**: 2025-01-25
**Maintained By**: Frontend Team
