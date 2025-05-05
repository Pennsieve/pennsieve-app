// ControlPanel.vue
<template>
  <div class="control-panel">
    <h3>Color Controls</h3>
    <div class="color-option">
      <label for="colorMode">Color Mode:</label>
      <select id="colorMode" v-model="localColorMode">
        <option v-for="([key, value], index) in props.colorMapMap" :key="key" :value="key">{{key}}</option>
      </select>
    </div>


    
    <div class="color-option">
      <div class="legend">
        <h4> Legend</h4>
          <div class="legend-item" v-for="(color, type) in colorScheme" :key="type">
            <div class="legend-color" :style="{ backgroundColor: rgbToHex(color[1]) }"></div>
            <div class="legend-label">{{ color[0] }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" >
import { ref, watch } from 'vue';

// Props with v-model support
const props = defineProps({
  pointCount: {
    type: Number,
    default: 5000
  },
  colorMode: {
    type: String,
    default: 'random'
  },
  startColor: {
    type: String,
    default: '#ff0000'
  },
  endColor: {
    type: String,
    default: '#0000ff'
  },
  singleColor: {
    type: String,
    default: '#4285f4'
  },
  options:  {
    type: Array,
    default: ["Type", "Species"]
  },
  colorScheme: {
    type: Map,
    default: new Map()
  },
  colorMapMap: {
    type: Map,
    default: new Map()
  }
});

// Emits
const emit = defineEmits([
  'update:pointCount',
  'update:colorMode',
  'update:startColor',
  'update:endColor',
  'update:singleColor',
  'regenerate'
]);

// Local state for two-way binding
const localPointCount = ref(props.pointCount);
const localColorMode = ref(props.colorMode);
const localStartColor = ref(props.startColor);
const localEndColor = ref(props.endColor);
const localSingleColor = ref(props.singleColor);


// Helper to convert RGB array to hex color
function rgbToHex(rgbArray) {
  const r = Math.round(rgbArray[0] * 255);
  const g = Math.round(rgbArray[1] * 255);
  const b = Math.round(rgbArray[2] * 255);
  return `rgb(${r}, ${g}, ${b})`;
}

// Apply color changes
function applyColors() {
  emit('updateColorMap', [localColorMode.value, props.colorMapMap.get(localColorMode.value)])
  emit('update:colorMode', localColorMode.value);
  emit('update:startColor', localStartColor.value);
  emit('update:endColor', localEndColor.value);
  emit('update:singleColor', localSingleColor.value);
}


// Watch for prop changes
watch(() => props.pointCount, (newVal) => {
  localPointCount.value = newVal;
});

watch(() => props.colorMode, (newVal) => {
  localColorMode.value = newVal;
});

watch(() => props.startColor, (newVal) => {
  localStartColor.value = newVal;
});

watch(() => props.endColor, (newVal) => {
  localEndColor.value = newVal;
});

watch(() => props.singleColor, (newVal) => {
  localSingleColor.value = newVal;
});

watch( () => localColorMode.value, (newVal) => {
  applyColors()
} )

// Watch for local changes
watch(localPointCount, (newVal) => {
  emit('update:pointCount', newVal);
});
</script>

<style scoped>
.control-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.8);
  padding: 15px;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 100;
  max-width: 300px;
}

h3 {
  margin-top: 0;
  margin-bottom: 10px;
}

h4 {
  margin-top: 10px;
  margin-bottom: 5px;
}

.color-option {
  margin-bottom: 15px;
}

label {
  display: inline-block;
  width: 120px;
}

input[type="range"] {
  width: 150px;
  margin-right: 10px;
}

button {
  margin-top: 10px;
  padding: 8px 12px;
  background: #4285f4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #3367d6;
}

.points-option {
  margin-top: 20px;
}

.legend-item {
  display: flex;
  align-items: center;
  margin: 5px 0;
}

.legend-color {
  width: 20px;
  height: 20px;
  margin-right: 10px;
  border-radius: 3px;
}

.legend-label {
  flex: 1;
  font-size: 14px;
}
</style>
