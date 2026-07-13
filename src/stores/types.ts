import type { SaveResult } from '@/services/storage'

export type StoreMutationResult<T> =
  | {
      success: true
      value: T
      saveResult: SaveResult
    }
  | {
      success: false
      reason: 'validation' | 'not-found'
      message: string
    }
