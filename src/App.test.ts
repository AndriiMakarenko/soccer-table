import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { cleanup, render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App.vue'
import router from './router'
import { persistenceService } from './services/storage'
import { NativePersistenceError } from './services/tauriPersistence'

describe('application shell', () => {
  beforeEach(() => {
    vi.spyOn(persistenceService, 'load').mockReturnValue({
      leagues: [],
      seasons: [],
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  /**
   * GIVEN the application router is initialized at the root route
   * WHEN App is rendered with Pinia, Vue Router, and PrimeVue
   * THEN the management dashboard and enabled first-league action are visible
   */
  it('renders the dashboard at the root route', async () => {
    await router.push('/')
    await router.isReady()

    render(App, {
      global: {
        plugins: [createPinia(), router, PrimeVue],
      },
    })

    expect(
      await screen.findByRole('heading', { name: 'League control' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Fixture Board')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Skip to main content' }),
    ).toHaveAttribute('href', '#main-content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(
      screen.getByRole('button', { name: 'Create your first league' }),
    ).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Create league' }),
    ).not.toBeInTheDocument()
  })

  /**
   * GIVEN browser persistence hydration is still pending
   * WHEN the application shell renders
   * THEN CRUD routes remain hidden behind an accessible startup state
   */
  it('gates routes while desktop startup is pending', async () => {
    vi.mocked(persistenceService.load).mockImplementation(
      () => new Promise(() => undefined),
    )

    render(App, {
      global: { plugins: [createPinia(), router, PrimeVue] },
    })

    expect(
      screen.getByRole('heading', {
        name: 'Restoring your tournaments…',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'League control' }),
    ).not.toBeInTheDocument()
  })

  /**
   * GIVEN the database is busy on first initialization and available later
   * WHEN the user retries startup
   * THEN actionable guidance is replaced by the hydrated CRUD route
   */
  it('presents a recoverable startup failure and retries hydration', async () => {
    vi.mocked(persistenceService.load)
      .mockRejectedValueOnce(
        new NativePersistenceError('busy', 'Database is locked.'),
      )
      .mockResolvedValueOnce({ leagues: [], seasons: [] })

    render(App, {
      global: { plugins: [createPinia(), router, PrimeVue] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is locked.',
    )
    expect(
      screen.getByText(/close other Fixture Board windows/i),
    ).toBeInTheDocument()
    await screen.getByRole('button', { name: 'Retry startup' }).click()

    expect(
      await screen.findByRole('heading', { name: 'League control' }),
    ).toBeInTheDocument()
    expect(persistenceService.load).toHaveBeenCalledTimes(2)
  })

  /**
   * GIVEN the renderer is launched directly without the Tauri command bridge
   * WHEN startup attempts database initialization
   * THEN the user is told to launch the desktop application and cannot run CRUD
   */
  it('explains unsupported direct browser launches', async () => {
    vi.mocked(persistenceService.load).mockRejectedValueOnce(
      new NativePersistenceError(
        'bridge-unavailable',
        'The desktop persistence bridge is unavailable.',
      ),
    )

    render(App, {
      global: { plugins: [createPinia(), router, PrimeVue] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'desktop persistence bridge is unavailable',
    )
    expect(
      screen.getByText(/launch Fixture Board through/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Retry startup' }),
    ).not.toBeInTheDocument()
  })
})
