// App.vue - Main Application Component
<template>
  <div class="app-container">

    <WebGLScatterplot
      :data="pointData"
      :metaData="metaData"
      :pointCount="pointCount"
      :color-map="colorMap"
      :colorMode="colorMode"
      :startColor="startColor"
      :endColor="endColor"
      :singleColor="singleColor"
      :forceRegenerate="forceRegenerate"
      :key="componentKey"
    />
    <ControlPanel
      v-model:pointCount="pointCount"
      v-model:colorMode="colorMode"
      v-model:startColor="startColor"
      v-model:endColor="endColor"
      v-model:singleColor="singleColor"
      :color-scheme="colorMap"
      :color-map-map="colorMapMap"
      @regenerate="regenerateData"
      @updateColorMap="updateColorMap"
    />
  </div>
</template>

<script setup lang="ts">
import {defineProps, onMounted, ref, watch} from 'vue';
import WebGLScatterplot from './scatterplot.vue';
import ControlPanel from './control.vue';
import {pathOr} from "ramda";
import {useGetToken} from "@/composables/useGetToken";
import {asyncBufferFromUrl, parquetMetadata, parquetRead} from "hyparquet";
import * as siteConfig from '@/site-config/site.json'


const props = defineProps({
  pkg: {
    type: Object,
    default: {}
  }

})

// Reactive state
const pointCount = ref(5000);
const colorMode = ref('random');
const startColor = ref('#ff0000');
const endColor = ref('#0000ff');
const singleColor = ref('#4285f4');
const forceRegenerate = ref(false);
const componentKey = ref(0);
const colorMapType = ref("")

const viewAssets = ref([])

const pointData = ref();
const metaData = ref();

const colorMap = ref(new Map());
const colorMapMap = ref(new Map())


watch( () => pointData.value, () => {
  generateColorMaps();
})

const presignedUrl = ref("")

onMounted(async () => {
  try {
    // get Viewer Assets
    await getViewerAssets()
    presignedUrl.value = await getFileUrl(viewAssets.value[0].content.id)
    console.log(presignedUrl)
    const res = await fetch(presignedUrl.value)
    const arrayBuffer = await res.arrayBuffer()

    await parquetRead({
      file: arrayBuffer,
      onComplete: (data) => {
        metaData.value = parquetMetadata(arrayBuffer)
        colorMode.value = metaData.value.key_value_metadata[0].key
        pointData.value = data

      }
    })


  } catch (err) {
    console.error(err);
  }
})

async function getViewerAssets() {
  const pkgId = pathOr('', ['content', 'id'], props.pkg)
  const token = await useGetToken()
  const url = `${siteConfig.apiUrl}/packages/${pkgId}/view?api_key=${token}`
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      viewAssets.value = await response.json()
      return
    }

    if (!response.ok) {
      return;
    }
  } catch (err) {
    console.error(err)
    throw err;
  }
}

async function getFileUrl(fileId) {

  const pkgId = pathOr('', ['content', 'id'], props.pkg)
  const token = await useGetToken()
  const url = `${siteConfig.apiUrl}/packages/${pkgId}/files/${fileId}?api_key=${token}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const result = await response.json()
      return result.url;
    }

    if (!response.ok) {
      return;
    }

  } catch (err) {
    console.error(err)
    throw err;
  }
}



// Method to trigger data regeneration in the scatterplot component
function regenerateData() {
  forceRegenerate.value = !forceRegenerate.value;
  componentKey.value++; // Force component re-creation
}

// Helper function to convert hex to RGB
function hexToRgb(hex) {
  try {
    // Ensure the hex string is properly formatted
    if (!hex || hex.length < 7) {
      console.warn(`Invalid hex color: ${hex}, using fallback`);
      return [1.0, 0.0, 0.0]; // Default to red
    }

    // Extract RGB components and normalize to 0-1 range for WebGL
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    // Ensure values are valid numbers
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      console.warn(`Invalid hex color components in: ${hex}, using fallback`);
      return [1.0, 0.0, 0.0]; // Default to red
    }

    return [r, g, b];
  } catch (err) {
    console.error('Error converting hex to RGB:', err);
    return [1.0, 0.0, 0.0]; // Default to red
  }

}

function generateColorMaps() {

  const hexColors = ["#4269d0","#efb118","#ff725c","#6cc5b0","#3ca951","#ff8ab7","#a463f2","#97bbf5","#9c6b4e","#9498a0"]
  const rgbColors = hexColors.map(color => hexToRgb(color))

  // iterate over Metadata Fields:
  for (let i = 0; i <(metaData.value.key_value_metadata.length-1); i++) {

    const type = metaData.value.key_value_metadata[i].key
    const values = JSON.parse(metaData.value.key_value_metadata[i].value)
    let valueMap = new Map()

    let vIndex = 0
    for (let v in values) {
      valueMap.set(values[v], rgbColors[vIndex%rgbColors.length])
      vIndex++
    }

    colorMapMap.value.set(type, valueMap)


    let varType = colorMapMap.value.get(type)
    if (varType == null) {
      colorMapMap.value.set(type, new Map())
    }
  }

}

function updateColorMap(data) {
  colorMapType.value = data[0]
  colorMap.value = data[1]
}
</script>

<style scoped>
  .app-container {
    height: 90vh;
    position: relative;
  }
</style>