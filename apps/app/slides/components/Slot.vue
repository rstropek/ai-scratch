<script setup lang="ts">
// A sticker slot as printed in the album: dashed outline, number in the middle while it is empty.
// Put a <Sticker> (or <StickerVideo>) in the default slot to show it filled. `label` is a small printed caption,
// `plate` sets it at text size as the sticker's name plate.
withDefaults(
  defineProps<{
    number?: string | number;
    size?: number;
    width?: number;
    height?: number;
    label?: string;
    plate?: boolean;
  }>(),
  { size: 150 },
);
</script>

<template>
  <div class="slot-wrap" :style="{ width: `${width ?? size}px` }">
    <div class="slot" :style="{ height: `${height ?? size}px` }">
      <slot>
        <span class="slot-no">{{ number }}</span>
      </slot>
    </div>
    <div v-if="label" class="slot-label" :class="{ plate }">{{ label }}</div>
  </div>
</template>

<style scoped>
.slot-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.slot {
  display: grid;
  place-items: center;
  width: 100%;
  border: 4px dashed color-mix(in srgb, var(--fg) 55%, transparent);
  border-radius: 22px;
  background: color-mix(in srgb, #fff 18%, transparent);
}

.slot-no {
  font-family: var(--font-display);
  font-size: var(--size-text);
  color: color-mix(in srgb, var(--fg) 75%, transparent);
}

.slot-label {
  font-size: var(--size-print);
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}

.slot-label.plate {
  font-size: var(--size-text);
  font-weight: 700;
}
</style>
