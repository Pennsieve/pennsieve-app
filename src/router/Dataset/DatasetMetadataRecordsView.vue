<script setup>

import {onMounted} from "vue";
import {useStore} from "vuex";
import RelationshipCreationWidget from '@/components/datasets/metadata/shared/RelationshipCreationWidget.vue'

const props = defineProps({
  orgId: {
    type: String,
    default: ''
  }
})

</script>


<template>
  <div class="dataset-metadata-view">
    <router-view name="stage" />
  </div>
</template>

