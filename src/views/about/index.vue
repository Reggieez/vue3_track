<script setup lang="ts">
import axios from 'axios'
import * as echarts from 'echarts'
import pkg from '../../../package.json'

defineOptions({
  name: 'About',
})

const data = ref()
const stayChartRef = ref<HTMLElement | null>(null)
const uvChartRef = ref<HTMLElement | null>(null)

let stayChart: echarts.ECharts | null = null
let uvChart: echarts.ECharts | null = null

onMounted(async () => {
  const res = await axios.get('/stats/overview')
  console.log(res.data.data)
  data.value = res.data.data

  // Initialize ECharts
  if (stayChartRef.value) {
    stayChart = echarts.init(stayChartRef.value)
  }
  if (uvChartRef.value) {
    uvChart = echarts.init(uvChartRef.value)
  }

  // Fetch stay data
  const stayRes = await axios.get('/stats/pages/stay', { params: { limit: 10 } })
  const stayData = stayRes.data?.data || []

  // Render stay chart
  if (stayChart) {
    stayChart.setOption({
      title: { text: '页面停留时间排行 (秒)', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '8%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value' },
      yAxis: {
        type: 'category',
        data: stayData.map((item: any) => item.page_title || item.page_url).reverse(),
        axisLabel: { width: 80, overflow: 'truncate' },
      },
      series: [
        {
          name: '总停留时间',
          type: 'bar',
          data: stayData.map((item: any) => item.total_stay_duration).reverse(),
          itemStyle: { color: '#57e994', borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right' },
        },
      ],
    })
  }

  // Fetch UV data
  const uvRes = await axios.get('/stats/pages/uv', { params: { limit: 10 } })
  const uvData = uvRes.data?.data || []

  // Render UV chart
  if (uvChart) {
    uvChart.setOption({
      title: { text: '页面访问用户数排行 (UV)', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '8%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value', minInterval: 1 },
      yAxis: {
        type: 'category',
        data: uvData.map((item: any) => item.page_title || item.page_url).reverse(),
        axisLabel: { width: 80, overflow: 'truncate' },
      },
      series: [
        {
          name: '访问人数',
          type: 'bar',
          data: uvData.map((item: any) => item.uv).reverse(),
          itemStyle: { color: '#5794e9', borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right' },
        },
      ],
    })
  }

  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  stayChart?.dispose()
  uvChart?.dispose()
})

function handleResize() {
  stayChart?.resize()
  uvChart?.resize()
}

const version = pkg.version
</script>

<template>
  <div class="about-page">
    <div>
      <div class="card red">
        PV: {{ data?.pv }}
      </div>
      <div class="card blue">
        UV: {{ data?.uv }}
      </div>
      <div class="card green">
        STAY: {{ data?.stay }}s
      </div>
    </div>

    <!-- 图表容器 -->
    <div class="charts-container">
      <div ref="stayChartRef" class="chart-box" />
      <div ref="uvChartRef" class="chart-box" />
    </div>

    <div class="text-sm text-gray-500 version-info">
      Version: {{ version }}
    </div>
  </div>
</template>

<style lang="less" scoped>
.about-page {
  padding-bottom: 24px;
}
.card {
  margin: 24px;
  padding: 24px;
  background-color: red;
  color: white;
  border-radius: 10px;
}
.red {
  background: #e95757;
}
.blue {
  background: #5794e9;
}
.green {
  background: #57e994;
}

.charts-container {
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.chart-box {
  width: 100%;
  height: 320px;
  background: #fff;
  border-radius: 10px;
  padding: 16px 0;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.version-info {
  text-align: center;
  margin-top: 32px;
}
</style>
