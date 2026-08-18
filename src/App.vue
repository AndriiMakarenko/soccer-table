<script setup lang="ts">
import AppBreadcrumbs from '@/components/layout/AppBreadcrumbs.vue'
import GlobalPersistenceError from '@/components/layout/GlobalPersistenceError.vue'
import AppShell from '@/components/layout/AppShell.vue'
import { globalPersistenceErrorHostKey } from '@/components/layout/persistenceErrorContext'
import { useAppStateStore } from '@/stores/appState'
import { provide } from 'vue'

const appState = useAppStateStore()

provide(globalPersistenceErrorHostKey, true)
if (!appState.isLoaded) void appState.load()
</script>

<template>
  <AppShell>
    <AppBreadcrumbs />
    <GlobalPersistenceError />
    <RouterView />
  </AppShell>
</template>
