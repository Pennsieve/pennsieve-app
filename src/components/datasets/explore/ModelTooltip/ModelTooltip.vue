<template>
  <div class="model-tooltip">
    <transition
      name="fade"
    >
      <div
        v-if="Object.keys(curModel).length"
        class="model-tooltip-wrap"
      >
        <h2>
          <router-link
            :to="modelSearchLink"
            class="model-name"
          >
            {{ curModel.displayName }}
<!---->
            <IconArrowRight
              class="ml-8"
              :height="10"
              :width="10"
            />
          </router-link>
        </h2>
        <div class="model-info">
          <div class="nr-props">
            <IconInfo
              class="mr-8"
              :height="16"
              :width="16"
            />
            <span>{{ propertyLabel }}</span>
          </div>
          <div class="nr-records">
            <IconDocument
              class="mr-8"
              :height="16"
              :width="16"
            />
            <span>{{ recordLabel }}</span>
          </div>

        </div>
<!--        <hr class="tiny-break">-->
        <div class="prop-list" v-for="p in curModel.props">
          <div class="prop-wrapper">
            <div class="prop-name">{{p.displayName}}</div>
            <div class="prop-type"><i>{{p.dataType}}</i></div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
  import { propOr } from 'ramda'

  import Pluralizer from '../../../../mixins/Pluralizer/index'
  import IconArrowUp from "../../../icons/IconArrowUp.vue";
  import IconArrowRight from "../../../icons/IconArrowRight.vue";
  import IconDocument from "../../../icons/IconDocument.vue";
  import IconInfo from "../../../icons/IconInfo.vue";
  import {mapGetters} from "vuex";

  export default {
    name: 'ModelTooltip',
    components: {IconInfo, IconDocument, IconArrowRight, IconArrowUp},
    mixins: [
      Pluralizer
    ],

    props: {
      modelId: {
        type: String,
        default: ''
      }
    },

    computed: {
      ...mapGetters('metadataModule',[
        'getModelById'
        ]),

      curModel: function(){
        const m = this.getModelById(this.modelId)
        if (m) {
          return m
        } else {
          return {}
        }
      },

      /**
       * Compute the label for records
       * @returns {String}
       */
      recordLabel: function() {
        const count = propOr(0, 'count', this.curModel)

        return this.pluralizer(count, 'Record', 'Records')
      },

      /**
       * Compute the label for properties
       * @returns {String}
       */
      propertyLabel: function() {
        const count = propOr(0, 'propertyCount', this.curModel)

        return this.pluralizer(count, 'Property', 'Properties')
      },

      /**
       * Computes the model search link
       * @return {Object | String}
       */
      modelSearchLink: function() {
        const modelId = propOr('', 'id', this.curModel)

        return {
          name: 'model-details',
          params: { modelId: modelId }
        }
      },
    }
  }
</script>

<style scoped lang="scss">
  @use '../../../../styles/theme';

  .prop-list {
    margin: 4px 0;
    .prop-wrapper {
      display: flex;
      .prop-name {
        color: theme.$purple_2;
        min-width: 120px;
      }
    }
  }

  .model-tooltip {
    left: 0;
    position: fixed;
    top: 0;
    z-index: 10;
  }
  .model-tooltip-wrap {
    padding: 8px;
    background: theme.$white;
    border: 1px solid theme.$gray_2;
    border-radius: 3px;
    color: theme.$gray_6;
    width: 291px;
  }

  .model-info {
    margin: 0 0 16px 0;
    display: flex;
    flex-direction: row;

    .nr-props {
     display: flex;
     min-width: 120px
    }
    .nr-records {
      display: flex
    }
  }

  .tiny-break {
    margin: 0 0 8px 0 ;
  }

  .model-name, ul {
    display: block;
    padding: 8px 0px;
  }
  .model-name {
    align-items: center;
    border-bottom: 1px solid theme.$gray_2;
    display: flex;
    font-size: 14px;
    font-weight: 400;
    line-height: 16px;
    justify-content: space-between;
    .svg-icon {
      flex-shrink: 0;
    }
  }
  li {
    align-items: center;
    display: flex;
    font-size: 12px;
    margin-bottom: 8px;
  }
</style>
