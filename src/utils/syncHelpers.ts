import { syncClient } from '@/services/syncClient'
import { ApiError } from '@/types/api'

/**
 * Wrapper for API operations that automatically handles 409 conflicts
 * by syncing and retrying the operation
 *
 * Usage:
 * ```ts
 * const result = await withSyncRetry(() => uploadImages(files))
 * ```
 *
 * @param operation - The async operation to execute
 * @param maxRetries - Maximum number of retries (default: 3)
 * @returns The result of the operation
 */
export async function withSyncRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: any = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Try the operation
      return await operation()
    } catch (error: any) {
      lastError = error

      // Check if it's a sync conflict (409)
      const isSyncConflict =
        error?.statusCode === 409 ||
        error?.requiresSync === true ||
        error?.error === 'Sync Conflict'

      if (isSyncConflict && attempt < maxRetries) {
        console.log(
          `[SyncHelper] Conflict detected on attempt ${attempt + 1}/${maxRetries + 1}. Syncing and retrying...`
        )

        try {
          // Sync to get latest operations
          await syncClient.handleConflict(error?.operationsBehind)

          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 500))

          // Continue to next iteration to retry
          continue
        } catch (syncError) {
          console.error('[SyncHelper] Sync failed during retry:', syncError)
          throw syncError
        }
      } else {
        // Not a sync conflict or max retries reached, throw the error
        throw error
      }
    }
  }

  // Should not reach here, but just in case
  throw lastError
}

/**
 * Wrapper for operations that should trigger a refresh after completion
 * Useful for operations that modify data and need UI to refresh
 *
 * @param operation - The async operation to execute
 * @param onSuccess - Callback to execute after successful operation
 */
export async function withRefresh<T>(
  operation: () => Promise<T>,
  onSuccess?: (result: T) => void | Promise<void>
): Promise<T> {
  const result = await withSyncRetry(operation)

  if (onSuccess) {
    await onSuccess(result)
  }

  // Trigger a custom event that components can listen to
  window.dispatchEvent(new CustomEvent('data-modified'))

  return result
}

/**
 * Check if an error is a sync conflict error
 */
export function isSyncConflictError(error: any): boolean {
  return (
    error?.statusCode === 409 ||
    error?.requiresSync === true ||
    error?.error === 'Sync Conflict'
  )
}

/**
 * Extract the number of operations behind from an error
 */
export function getOperationsBehind(error: any): number | undefined {
  return error?.operationsBehind
}
