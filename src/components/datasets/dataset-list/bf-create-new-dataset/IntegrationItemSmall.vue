<template>
  <div class="integration-item-small">

    <el-row
      type="flex"
      align="middle"
      class="info"
    >
      <el-col
        :sm="24"
      >
        <div class="integration-title">
          {{integration.displayName}}
        </div>
      </el-col>
      <el-col
        :sm="24"
        class="activeSwitch"
      >
        <el-switch
          v-model="isActive"
          active-color="#5039F7"
          inactive-color="#CAC5BF">
        </el-switch>
      </el-col>
    </el-row>
    <el-row>

    </el-row>
    <el-row>
      <p class="integration-description">
        {{integration.description}}

      </p>
    </el-row>

  </div>
</template>

<script>

import {
  mapActions,
} from 'vuex'

export default {
  name: 'IntegrationItemSmall',

  components: {
  },

  props: {
    integration: {
      type: Object,
      default: () => ({})
    },
    /**
     * Used to reset switches to default position every time window is opened.
     */
    openIndex: {
      type: Number,
      default:-1
    }
  },

  data: function() {
    return {
      isActive: false
    }
  },

  mounted: function() {
    this.isActive = this.integration.isDefault
  },

  watch: {
    openIndex: function() {
      this.isActive = this.integration.isDefault
    },
    /**
     * When switch is toggled, send event to parent. We are not using sync because the parent
     * needs to perform additional actions.
     * @param val
     */
    isActive: function(val) {
      this.integration.isActive = val
      this.$emit('updateIsActive', this.integration)
    }
  },

  methods: {
    ...mapActions([
      'updateDataset'
    ]),
  }
}
</script>

<style scoped lang="scss">
@use '../../../../styles/theme';

.integration-menu {
  width: 24px;
}

.activeSwitch {
  width: fit-content;
}

.integration-item-small {
  border-bottom: 1px solid theme.$gray_2;
  margin: 0 0 16px 0;
}
.integration-title {
  font-size: 12px;
  margin-bottom: 8px;
  font-weight: 500;
  color: theme.$gray_5;
}

.intergration-type {
  color: theme.$gray_5;
  font-weight: 500;
  font-size: 12px;
}

.integration-description {
  font-size: 14px;
  color: theme.$gray_4;
  max-width: 500px;
}

.list-item-col-spacer {
  padding-top: 32px;
}

</style>
