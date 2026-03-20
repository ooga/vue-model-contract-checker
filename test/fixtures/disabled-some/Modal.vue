<script setup lang="ts">
const visible = defineModel<boolean>('visible');
const visible2 = defineModel<boolean>('visible2');
const visible3 = defineModel<boolean>('visible3');
</script>
<template>
  <div v-if="visible">Modal</div>
  <div v-if="visible2">Modal2</div>
  <div v-if="visible3">Modal3</div>
</template>
