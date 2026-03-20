<script setup lang="ts">
import { ref } from 'vue';
import Modal from './Modal.vue';

const show = ref(false);
</script>
<template>
  <Modal v-model:visible="show" />
</template>
