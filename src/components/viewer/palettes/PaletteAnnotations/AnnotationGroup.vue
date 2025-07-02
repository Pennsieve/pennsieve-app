<template>
  <div class="controls-icons">
    <el-tooltip
      placement="top"
      content="Hide"
      :open-delay="300"
    >
      <button @click="onToggleVisibility">
        <IconEyeball
          :height="16"
          :width="16"
        />
      </button>
    </el-tooltip>
  </div>

</template>

<script>
  import { mapState, mapActions } from 'vuex'
  import Request from '../../../../mixins/request'
  import IconEyeball from "../../../icons/IconEyeball.vue";

  export default {
    name: 'AnnotationGroup',
    components: {IconEyeball},
    mixins: [
      Request
    ],

    props: {
      layer: {
        type: Object,
        default: function() {
        return {}
        }
      },
      hide_title: {
        type: Boolean,
        default: true
      },
      orig_label: {
        type: String,
        default: ""
      },
      can_crud_annotation: {
        type: Boolean,
        default: false
      }
    },

    data: function() {
      return {
        newLabel: ''
      }
    },

    computed: {
      ...mapState('viewerModule', ['activeViewer']),
      ...mapState([
        'config',
        'bulkEditingChannels'
      ]),

    },
    methods: {
      onToggleVisibility: function(event) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
  }
</script>

<style lang="scss" scoped>
  @import '../../../../assets/_variables.scss';

  .controls-icons {
    padding-right: 8px;

  }

  .bf-channel {
    background: #F7F7F7;
    border-bottom: 1px solid $gray_6;
    box-sizing: border-box;
    display: flex;
    padding: 3px 8px 3px 16px;
    &:hover {
      background: #fff;
    }
    &:not(.visible) {
      .channel-info {
        opacity: .4
      }
      .svg-icon {
        color: #9b9b9b;
      }
    }
  }

  .channel-info {
    color: $gray_3;
    flex: 1;
  }
  .channel-controls {
    align-items: center;
    display: none;
    .bf-channel:hover & {
      display: flex;
    }
    .bf-channel.editing & {
      display: none;
    }

    button {
      color: #000;
    }
  }

  h2 {
    font-size: 13px;
    margin-bottom: 2px;
  }
  .selected {
      color: $purple_2
    }
  button {
    &:hover, &:focus {
      color: $app-primary-color;
    }
  }
</style>

<style lang="scss">
.bf-channel {
  .channel-input-wrapper {
    width: 164px;
  }
  .el-input__inner {
    height: 18px !important;
    font-size: 12px;
    padding: 0 4px;
  }
  .revert {
    margin-left: 8px;
  }
  .label-group {
    display: flex;
    flex-direction: row;
    align-items: center;
  }
  .filter-present {
    margin-left: 5px;
  }
}
</style>
