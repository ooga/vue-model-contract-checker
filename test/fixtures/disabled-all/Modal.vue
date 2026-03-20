<script setup lang="ts">
const visible = defineModel<boolean>('visible');
const visible2 = defineModel<boolean>('visible2');
</script>
<template>
  <div v-if="visible">Modal</div>
  <div v-if="visible2">Modal2</div>
</template>
