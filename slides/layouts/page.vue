<script setup lang="ts">
import { useSlideContext } from '@slidev/client';
import { computed } from 'vue';

// One album page: a full-bleed ground in a Scratch block colour.
// `ink: dark` switches the text to dark ink for light grounds (yellow, green, pink).
const props = withDefaults(
  defineProps<{
    color?: 'looks' | 'motion' | 'events' | 'operators' | 'myblocks' | 'sound' | 'control';
    ink?: 'light' | 'dark';
    pageNumber?: boolean;
  }>(),
  { color: 'looks', ink: 'light', pageNumber: true },
);

const { $page } = useSlideContext();
const ground = computed(() => `var(--${props.color})`);
</script>

<template>
  <div class="slidev-layout album-page" :class="{ 'ink-dark': ink === 'dark' }" :style="{ '--ground': ground }">
    <slot />
    <div v-if="pageNumber" class="page-no" aria-label="Seite">{{ $page }}</div>
  </div>
</template>
