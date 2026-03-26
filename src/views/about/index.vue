<script setup lang="ts">
import axios from 'axios'
import pkg from '../../../package.json'

defineOptions({
  name: 'About',
})

onMounted(async () => {
  const res = await axios.get('/stats/overview')
  console.log(res.data.data)
})

const version = pkg.version
</script>

<template>
  <div>about</div>
  <div class="text-sm text-gray-500">
    Version: {{ version }}
  </div>
</template>
