<script setup lang="ts">
import AppBreadcrumbs from '@/components/layout/AppBreadcrumbs.vue'
import GlobalPersistenceError from '@/components/layout/GlobalPersistenceError.vue'
import AppShell from '@/components/layout/AppShell.vue'
import DesktopStartupState from '@/components/layout/DesktopStartupState.vue'
import { globalPersistenceErrorHostKey } from '@/components/layout/persistenceErrorContext'
import { useAppStateStore } from '@/stores/appState'
import { onBeforeUnmount, onMounted, provide, shallowRef } from 'vue'
import { coordinateDesktopShutdown } from '@/services/desktopLifecycle'

const appState = useAppStateStore()

provide(globalPersistenceErrorHostKey, true)
if (!appState.isLoaded) void appState.load()

const shutdownError = shallowRef<string | null>(null)
let stopCloseListener: (() => void) | undefined

onMounted(async () => {
  stopCloseListener = await coordinateDesktopShutdown(
    appState.waitForPendingSaves,
    () => {
      shutdownError.value =
        'Fixture Board could not finish saving. Resolve the error and close the window again.'
    },
  )
})

onBeforeUnmount(() => stopCloseListener?.())
</script>

<template>
  <AppShell>
    <DesktopStartupState v-if="!appState.isLoaded" />
    <template v-else>
      <p v-if="shutdownError" class="shutdown-error" role="alert">
        {{ shutdownError }}
      </p>
      <AppBreadcrumbs />
      <GlobalPersistenceError />
      <RouterView />
    </template>
  </AppShell>
</template>

<style scoped>
.shutdown-error {
  margin: 1rem 0 0;
  padding: 0.8rem 1rem;
  border: 1px solid var(--color-danger);
  border-radius: 0.5rem;
  color: var(--color-chalk);
}
</style>
