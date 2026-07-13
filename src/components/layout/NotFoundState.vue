<script setup lang="ts">
import Button from 'primevue/button'
import type { RouteLocationRaw } from 'vue-router'

withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    detail: string
    returnLabel?: string
    returnTo?: RouteLocationRaw
  }>(),
  {
    eyebrow: 'Page not found',
    returnLabel: 'Return to leagues',
    returnTo: '/',
  },
)
</script>

<template>
  <section class="not-found" aria-labelledby="not-found-title">
    <p class="eyebrow">{{ eyebrow }}</p>
    <h1 id="not-found-title">{{ title }}</h1>
    <p>{{ detail }}</p>
    <Button :label="returnLabel" :as="'router-link'" :to="returnTo" />
  </section>
</template>

<style scoped>
.not-found {
  max-width: 48rem;
  padding-block: clamp(2.5rem, 6vw, 5rem);
}

.eyebrow {
  margin: 0;
  color: var(--color-muted);
  font: 600 0.7rem/1.4 var(--font-utility);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.not-found h1 {
  max-width: 16ch;
  margin: 0.65rem 0 0;
  font-family: var(--font-headline);
  font-size: clamp(2.8rem, 7vw, 5rem);
  font-weight: 780;
  letter-spacing: -0.05em;
  line-height: 0.96;
}

.not-found > p:not(.eyebrow) {
  max-width: 44rem;
  margin: 1rem 0 0;
  color: var(--color-muted);
  line-height: 1.65;
}

.not-found :deep(.p-button) {
  margin-top: 1.5rem;
}
</style>
