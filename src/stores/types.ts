import type { SaveResult } from '@/services/storage'

export type StoreMutationResult<T> =
  | {
      success: true
      value: T
      saveResult: Promise<SaveResult>
    }
  | {
      success: false
      reason: 'validation' | 'not-found' | 'locked' | 'confirmation-required'
      message: string
    }
