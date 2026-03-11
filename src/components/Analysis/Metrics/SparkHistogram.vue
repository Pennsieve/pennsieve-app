<script setup>
import { ref, watch, onMounted } from 'vue'
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
    default: 200,
  },
  height: {
    type: Number,
    default: 90,
  },
  formatFn: {
    type: Function,
    default: (v) => String(v),
  },
})

const svgRef = ref(null)

const margin = { top: 4, right: 4, bottom: 20, left: 28 }

const renderChart = () => {
  if (!svgRef.value || !props.bins.length) return

  const svg = d3.select(svgRef.value)
  const w = props.width - margin.left - margin.right
  const h = props.height - margin.top - margin.bottom

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

onMounted(() => renderChart())
watch(() => props.bins, renderChart, { deep: true })
</script>

<template>
  <div class="spark-histogram">
    <div v-if="label" class="spark-label">{{ label }}</div>
    <svg
      ref="svgRef"
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
    />
  </div>
</template>

<style scoped>
.spark-histogram {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
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
