<script setup lang="ts">
const visible = defineModel<boolean>('visible');
</script>
<template>
  <div v-if="visible">Modal</div>
</template>
