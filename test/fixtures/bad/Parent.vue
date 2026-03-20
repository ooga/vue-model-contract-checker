<script setup lang="ts">
import { ref } from 'vue';
import Modal from './Modal.vue';

const show = ref(false);
</script>
<template>
  <Modal :visible="show" />
</template>
