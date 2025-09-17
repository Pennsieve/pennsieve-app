<template>
    <bf-stage>
      <div
        class="models"
        element-loading-background="transparent"
      >
        <div
          class="graph-management-cards"
        >
          <button
            @click="openModelGenerator"
          >
            <bf-card
              :class="{ disabled: datasetLocked }"
              title="New Model"
              card-copy="Create a new model for metadata records."
            >
              <template #icon>
                <icon-add-template
                  class="card-icon"
                  :height="48"
                  :width="48"
                />
              </template>
            </bf-card>
          </button>
          <button
            @click="openTemplateGallery"
          >
            <bf-card
              :class="{ disabled: datasetLocked }"
              title="Template Gallery"
              card-copy="Create a model based on a template"
            >
              <template #icon>
                <IconOverview
                  class="card-icon"
                  :height="48"
                  :width="96"
                />

              </template>
            </bf-card>
          </button>
        </div>

        <div >
          <h2>Dataset Models</h2>
          <model-list-item
            v-for="item in models"
            :model="item.model"
          />
        </div>


<!--        <dataset-owner-message-->
<!--          v-if="!hasModels"-->
<!--          title="You have no metadata models defined yet"-->
<!--          :display-owner-message="true"-->
<!--          :hide-got-it="true"-->
<!--          class="long-copy"-->
<!--        >-->
<!--          <img-->
<!--            slot="img"-->
<!--            src="/src/assets/images/illustrations/illo-missing-models.svg"-->
<!--            alt=""-->
<!--          >-->
<!--          <template #copy>-->
<!--            <p>-->
<!--              Models are the basis of your metadata schema. Before adding metadata records, you'll need to <br> create some models-->
<!--            </p>-->
<!--          </template>-->

<!--          <template #button>-->
<!--            <bf-button-->
<!--              class="new-model-button"-->
<!--              :disabled="datasetLocked"-->
<!--              @click=""-->
<!--            >-->
<!--              New Model-->
<!--            </bf-button>-->
<!--          </template>-->

<!--&lt;!&ndash;          <p&ndash;&gt;-->
<!--&lt;!&ndash;            v-if="modelTemplates.length > 0 && datasetLocked === false"&ndash;&gt;-->
<!--&lt;!&ndash;            slot="link"&ndash;&gt;-->
<!--&lt;!&ndash;          >&ndash;&gt;-->
<!--&lt;!&ndash;            <router-link :to="{ name: 'model-templates' }">&ndash;&gt;-->
<!--&lt;!&ndash;              Add a model from a template&ndash;&gt;-->
<!--&lt;!&ndash;            </router-link>&ndash;&gt;-->
<!--&lt;!&ndash;          </p>&ndash;&gt;-->
<!--        </dataset-owner-message>-->


      </div>

    </bf-stage>
</template>

<script lang=ts setup>

import {onMounted, defineAsyncComponent} from 'vue'
import { storeToRefs } from "pinia";
import { useMetadataStore } from '@/stores/metadataStore.js'
import IconOverview from "@/components/icons/IconOverview.vue";
import BfCard from "@/components/shared/bf-card/BfCard.vue";
import IconAddTemplate from "@/components/icons/IconAddTemplate.vue";
import ModelListItem from "@/components/datasets/metadata/models/modelListItem.vue";
// Dynamic import to avoid circular dependency issues
const TemplateGallery = defineAsyncComponent(() => import("@/components/datasets/metadata/models/TemplateGallery.vue"))
import {useRouter} from "vue-router";


// Props Setup
const props = defineProps({
  orgId: {
    type: String,
    default: ''
  },
  datasetId: {
    type: String,
    default: ''
  }
})


// Store Setup
const metadataStore = useMetadataStore();
const { models } = storeToRefs(metadataStore);
// const vuexStore = useStore()


// Run when starting up
onMounted(async () => {
  try {
    await metadataStore.fetchModels(props.datasetId)
  } catch (err) {
    console.error(err);
  }
})

const datasetLocked = false
const router = useRouter()

// Methods
const openModelGenerator = () => {
  router.push({
    name: 'new-model',
    params: {
      datasetId: props.datasetId,
      orgId: props.orgId,
    }
  })
}

const openTemplateGallery = () => {
  router.push({
    name: 'new-model-from-template',
    params: {
      datasetId: props.datasetId,
      orgId: props.orgId,
    }
  })
}

</script>



<style lang="scss" scoped>
@use '../../../../styles/theme';

.card-icon {
  color: theme.$purple_2;
}

.models {
  min-height: 500px;

  h2 {
    font-size: 20px;
    line-height: 24px;
  }

  .owner-message p {
    max-width: 680px;
  }

  .graph-management-cards {
    display: flex;
    margin-bottom: 48px;

  }

  .gallery-link {
    &:hover {
      text-decoration: none;
    }
    &.disabled {
      cursor: default;
      opacity: .6;
    }
  }

  .view-templates-link {
    align-items: center;
    display: flex;
    justify-content: center;

    .view-templates-link-text {
      width: 64px;
    }
  }

  .bf-card {
    height: 183px;
    min-width: 175px;
    max-width: 175px;
    padding: 32px 16px;
  }

  .owner-message p {
    max-width: 680px;
  }

  .long-copy {
    border: none;
    img {
      height: 74px;
      width: 109px;
    }

    p {
      color: #71747C;
      font-size: 14px;
      line-height: 16px;
      text-align: center;
      padding-bottom: 16px;
    }

    .new-model-button {
      height: 40px;
      width: 114px;
      margin-bottom: 16px;
    }
  }
}
</style>
