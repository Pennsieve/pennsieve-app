<template>
  <div :class="['bf-stage', this.isEditing ? 'editing' : '']">

    <template v-if="this.$slots['actions']">
      <div class="buttons">
       <slot name="actions"/>
      </div>
    </template>

    <template v-if="this.$slots['sidebar']">
      <div class="bf-sidebar-wrap">
        <div :class="stageContentClass">
          <slot />
        </div>

        <div class="stage-sidebar">
          <slot name="sidebar" />
        </div>
      </div>
    </template>

    <template v-else>
      <div :class="stageContentClass">
        <slot />
      </div>
    </template>
  </div>
</template>

<script>
  import EventBus from '../../../utils/event-bus'
  import throttle from 'lodash/throttle'

  export default {
    name: 'BfStage',

    props: {
      isEditing: {
        type: Boolean,
        default: false
      },
      orgId: {
        type: String,
        default: ''
      },
      datasetId: {
        type: String,
        default: ''
      },
      noPadding: {
        type: Boolean,
        default: false
      },
    },

    mounted: function() {
    this.$el.addEventListener('scroll', this.onScroll)
    },

    beforeUnmount: function() {
      this.$el.removeEventListener('scroll', this.onScroll)
    },

    computed: {
      stageContentClass: function() {
        let classString = "bf-stage-content"
        if (!this.$slots['actions']) {
          classString = classString + " no-actions"
        }
        if (this.noPadding) {
          classString = classString + " no-padding"
        }

        return classString
        // return this.$slots['actions']? "bf-stage-content" : "bf-stage-content no-actions"
      }
    },

    methods: {
      /**
       * Method to scroll to top of the page
       */
      scrollToTop: function(){
        this.$el.scrollTop = 0
      },
      /**
       * Fire scroll event for BfPage to listen for
       * @param {Object} evt
       */
      onScroll: throttle(
        function(evt) {
          EventBus.$emit('stage-scroll', evt)
        },
        75
      )
    }
  }
</script>

<style scoped lang="scss">
  @use '../../../styles/theme';

  .bf-stage {
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    &.editing {
      background: theme.$gray_1;
    }
  }
  .bf-stage-content {
    box-sizing: border-box;
    min-height: calc(100% - 72px);
    padding: 8px 32px;
    display: flex;
    flex-direction: column;
    overflow: auto;

    &.no-actions {
      padding: 32px;
      min-height: 100%;
    }

    &.no-padding {
      padding: 0;
    }
  }
  .graph-management {
    .bf-stage-content {
      padding: 24px 32px 32px 32px;
    }
  }
  .bf-sidebar-wrap {
    background-color: theme.$white;
    display: flex;
    min-height: 100%;
    .editing & {
      background: inherit;
    }
    .bf-stage-content {
      flex: 1;

    }
  }
  .stage-sidebar {
    border-left: 1px solid theme.$gray_2;
    box-sizing: border-box;
    width: 360px;
    h2 {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    h3 {
      font-size: 20px;
      font-weight: 400;
    }
    h2, h3 {
      color: #000;
      margin: 0 0 8px;
    }
  }
  .sidebar-component {
    border-top: 1px solid theme.$gray_2;
    &:first-child {
      border: none;
    }
  }

  .buttons {
    display: flex;
    flex-direction: row;
    justify-content: end;
    margin: 16px 32px 16px 16px;
  }
</style>
