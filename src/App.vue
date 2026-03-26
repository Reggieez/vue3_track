<script setup lang="ts">
import { useRoute } from 'vue-router'
// 埋点SDK
import { initTrack } from './sdk/track'

const route = useRoute()

// 初始化埋点
initTrack(route)
</script>

<template>
  <router-view />
</template>

<style></style>
