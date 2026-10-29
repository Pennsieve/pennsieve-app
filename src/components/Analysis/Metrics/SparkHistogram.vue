<script setup>
// A histogram drawn at the size its box has on the page: the box is
// measured (ResizeObserver) and the chart re-rendered at that many pixels,
// so the bars fill the panel it sits in and the axis text keeps its size,
// instead of a fixed drawing scaled up with the text in it. width and
// height, when given, fix the size instead.
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as d3 from 'd3'

const props = defineProps({
  bins: {
    type: Array,
    default: () => [],
  },
  label: {
    type: String,
    default: '',
  },
  color: {
    type: String,
    default: '#7C3AED',
  },
  width: {
    type: Number,
    default: 0,
  },
  height: {
    type: Number,
    default: 0,
  },
  formatFn: {
    type: Function,
    default: (v) => String(v),
  },
})

const svgRef = ref(null)
const boxRef = ref(null)
// The size drawn at: the props when given, else the box's.
const size = ref({ width: props.width || 200, height: props.height || 90 })
let observer = null

const margin = { top: 4, right: 4, bottom: 20, left: 28 }

const measure = () => {
  if (!boxRef.value || (props.width && props.height)) return
  const rect = boxRef.value.getBoundingClientRect()
  const width = props.width || Math.floor(rect.width)
  const height = props.height || Math.floor(rect.height)
  if (width > 0 && height > 0 && (width !== size.value.width || height !== size.value.height)) {
    size.value = { width, height }
  }
}

const renderChart = () => {
  if (!svgRef.value || !props.bins.length) return

  const svg = d3.select(svgRef.value)
  const w = size.value.width - margin.left - margin.right
  const h = size.value.height - margin.top - margin.bottom

  svg.selectAll('g.chart-area').remove()

  const g = svg
    .append('g')
    .attr('class', 'chart-area')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  const xMin = d3.min(props.bins, (d) => d.binStart)
  const xMax = d3.max(props.bins, (d) => d.binEnd)
  const yMax = d3.max(props.bins, (d) => d.count)

  const x = d3.scaleLinear().domain([xMin, xMax]).range([0, w])
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([h, 0])

  // X axis
  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${h})`)
    .call(
      d3.axisBottom(x)
        .ticks(4)
        .tickFormat((v) => props.formatFn(v))
        .tickSize(2)
    )
    .call((g) => g.select('.domain').attr('stroke', '#d1d5db'))
    .call((g) => g.selectAll('.tick line').attr('stroke', '#d1d5db'))
    .call((g) =>
      g.selectAll('.tick text')
        .attr('fill', '#9ca3af')
        .attr('font-size', '10px')
    )

  // Y axis
  g.append('g')
    .attr('class', 'y-axis')
    .call(
      d3.axisLeft(y)
        .ticks(3)
        .tickFormat(d3.format('d'))
        .tickSize(2)
    )
    .call((g) => g.select('.domain').attr('stroke', '#d1d5db'))
    .call((g) => g.selectAll('.tick line').attr('stroke', '#d1d5db'))
    .call((g) =>
      g.selectAll('.tick text')
        .attr('fill', '#9ca3af')
        .attr('font-size', '10px')
    )

  // Bars
  const barPadding = 1
  g.selectAll('rect.bar')
    .data(props.bins)
    .join(
      (enter) =>
        enter
          .append('rect')
          .attr('class', 'bar')
          .attr('x', (d) => x(d.binStart) + barPadding)
          .attr('width', (d) => Math.max(0, x(d.binEnd) - x(d.binStart) - barPadding * 2))
          .attr('y', h)
          .attr('height', 0)
          .attr('fill', props.color)
          .attr('rx', 1)
          .call((enter) =>
            enter
              .transition()
              .duration(400)
              .attr('y', (d) => y(d.count))
              .attr('height', (d) => h - y(d.count))
          ),
      (update) =>
        update.call((update) =>
          update
            .transition()
            .duration(400)
            .attr('x', (d) => x(d.binStart) + barPadding)
            .attr('width', (d) => Math.max(0, x(d.binEnd) - x(d.binStart) - barPadding * 2))
            .attr('y', (d) => y(d.count))
            .attr('height', (d) => h - y(d.count))
        ),
      (exit) => exit.transition().duration(200).attr('height', 0).attr('y', h).remove()
    )
}

onMounted(() => {
  measure()
  if (!(props.width && props.height) && typeof ResizeObserver !== 'undefined' && boxRef.value) {
    observer = new ResizeObserver(measure)
    observer.observe(boxRef.value)
  }
  renderChart()
})
onBeforeUnmount(() => observer?.disconnect())
watch(() => props.bins, renderChart, { deep: true })
watch(size, renderChart)
</script>

<template>
  <div class="spark-histogram">
    <div v-if="label" class="spark-label">{{ label }}</div>
    <div ref="boxRef" class="spark-box">
      <svg
        ref="svgRef"
        :width="size.width"
        :height="size.height"
        :viewBox="`0 0 ${size.width} ${size.height}`"
      />
    </div>
  </div>
</template>

<style scoped>
.spark-histogram {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.spark-box {
  flex: 1;
  min-height: 90px;
  min-width: 0;
}

.spark-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #6b7280;
  margin-bottom: 2px;
}
</style>
