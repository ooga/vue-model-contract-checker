<script setup lang="ts">
import { ref } from 'vue';
import Modal from './Modal.vue';

const show = ref(false);
const show2 = ref(false);
</script>
<template>
  <!-- vue-model-contract-checker-disable-next-component -->
  <Modal 
  :visible="show"
  :visible2="show2"
   />
</template>
