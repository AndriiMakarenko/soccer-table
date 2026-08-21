import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { serializeAppState } from '@/domain/stateInterchange'
import { persistenceService } from '@/services/storage'
import { stateTransferFileAdapter } from '@/services/stateTransferFiles'
import { useAppStateStore } from '@/stores/appState'

import StateTransferControls from './StateTransferControls.vue'

function renderControls() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useAppStateStore()
  const rendered = render(StateTransferControls, {
    global: { plugins: [pinia, PrimeVue] },
  })
  return { store, ...rendered }
}

describe('StateTransferControls', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(persistenceService, 'save').mockResolvedValue({ success: true })
    vi.spyOn(stateTransferFileAdapter, 'pickImportFile').mockResolvedValue(null)
    vi.spyOn(stateTransferFileAdapter, 'saveExportFile').mockResolvedValue(true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  /**
   * GIVEN the application shell transfer area is rendered
   * WHEN its controls are inspected in document order
   * THEN accessible IMPORT and EXPORT buttons replace the old storage label
   */
  it('renders accessible controls in import then export order', () => {
    renderControls()
    const controls = screen.getByLabelText('Tournament data transfer')
    expect(
      within(controls)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['IMPORT', 'EXPORT'])
    expect(screen.queryByText('Stored locally')).not.toBeInTheDocument()
  })

  /**
   * GIVEN a valid backup file and existing application data
   * WHEN the user chooses replacement, cancels once, then explicitly confirms
   * THEN cancellation preserves data and confirmation replaces it exactly once
   */
  it('requires explicit confirmation before replacement and supports cancellation', async () => {
    const { store } = renderControls()
    store.leagues.push(league('old', 'Old League'))
    vi.mocked(stateTransferFileAdapter.pickImportFile).mockResolvedValue(
      serializeAppState({
        leagues: [league('new', 'New League')],
        seasons: [],
      }),
    )
    await fireEvent.click(screen.getByRole('button', { name: 'IMPORT' }))
    let dialog = await screen.findByRole('dialog', {
      name: 'Import tournament data',
    })
    await fireEvent.click(
      within(dialog).getByRole('button', { name: 'Replace all' }),
    )
    dialog = await screen.findByRole('dialog', {
      name: 'Replace all tournament data?',
    })
    await fireEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    )
    expect(store.leagues[0]?.name).toBe('Old League')

    await fireEvent.click(screen.getByRole('button', { name: 'IMPORT' }))
    dialog = await screen.findByRole('dialog', {
      name: 'Import tournament data',
    })
    await fireEvent.click(
      within(dialog).getByRole('button', { name: 'Replace all' }),
    )
    dialog = await screen.findByRole('dialog', {
      name: 'Replace all tournament data?',
    })
    await fireEvent.click(
      within(dialog).getByRole('button', { name: 'Replace all data' }),
    )

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'imported successfully',
      ),
    )
    expect(store.leagues.map(({ name }) => name)).toEqual(['New League'])
    expect(persistenceService.save).toHaveBeenCalledTimes(1)
  })

  /**
   * GIVEN a merge backup contains two league-name conflicts and one new league
   * WHEN the user chooses merge
   * THEN the whole conflicting leagues are skipped and every skipped name is reported
   */
  it('merges non-conflicting leagues and reports multiple conflicts', async () => {
    const { store } = renderControls()
    store.leagues.push(league('one', 'Alpha'), league('two', 'Beta'))
    vi.mocked(stateTransferFileAdapter.pickImportFile).mockResolvedValue(
      serializeAppState({
        leagues: [
          league('a', 'Alpha'),
          league('b', 'Beta'),
          league('g', 'Gamma'),
        ],
        seasons: [],
      }),
    )
    await fireEvent.click(screen.getByRole('button', { name: 'IMPORT' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Import tournament data',
    })
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }))

    expect(
      await screen.findByText(/Skipped leagues: Alpha, Beta/),
    ).toHaveAttribute('role', 'status')
    expect(store.leagues.map(({ name }) => name)).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
    ])
  })

  /**
   * GIVEN a file operation remains pending and then rejects
   * WHEN the user starts export
   * THEN duplicate actions are disabled and the failure is announced accessibly
   */
  it('disables duplicate actions during progress and announces failures', async () => {
    let rejectWrite!: (error: Error) => void
    vi.mocked(stateTransferFileAdapter.saveExportFile).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectWrite = reject
      }),
    )
    renderControls()

    await fireEvent.click(screen.getByRole('button', { name: 'EXPORT' }))
    expect(screen.getByRole('button', { name: 'IMPORT' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'EXPORT' })).toBeDisabled()
    rejectWrite(new Error('The selected file could not be written.'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not be written',
    )
    expect(screen.getByRole('button', { name: 'EXPORT' })).toBeEnabled()
  })
})

function league(id: string, name: string) {
  return {
    id,
    name,
    createdAt: '2026-08-21T10:00:00.000Z',
    updatedAt: '2026-08-21T10:00:00.000Z',
  }
}
