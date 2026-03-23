<template>
  <div
    class="dataset-license"
  >
    <p class="license-help">
      Select a license to let others know how they can use your data.
      <a
        href="https://docs.pennsieve.io/docs/common-dataset-licenses"
        target="_blank"
      >
        Learn more
      </a>
    </p>
    <el-select
      v-if="dataset.content"
      ref="inputLicense"
      v-model="dataset.content.license"
      placeholder="No License Selected"
      :disabled="datasetLocked"
      @change="changeLicenseSelection"
    >
      <template #prefix>
        <IconLicense
          :height="20"
          :width="20"
          />
      </template>

      <el-option-group
        v-for="license in licenses"
        :key="license.label"
        :label="license.label"
      >
        <el-option
          v-for="option in license.options"
          :key="option.label"
          :label="option.label"
          :value="option.value"
        />
      </el-option-group>
    </el-select>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import licenses from '../dataset-licenses'
import IconLicense from "../../../icons/IconLicense.vue";
  export default {
    name: 'DatasetLicense',
    components: {IconLicense},
    data() {
      return {
        licenseVal: '',
        licenses: licenses
      }
    },
    computed: {
      ...mapState(['dataset']),
      ...mapGetters(['datasetLocked']),
    },

    methods: {
      /**
       * Emit event to change dataset lidense
       */
      changeLicenseSelection: function() {
        this.$emit('change-license')
      }
    },
  }
</script>

<style lang="scss" scoped>
@use '../../../../styles/theme';
@use '../../../../styles/element/select';

.dataset-license {
  .svg-icon {
    margin-top: 10px;
  }

  .el-select {
    width: 100%;
  }

  .license-help {
    font-size: 13px;
    color: theme.$gray_5;
    margin-bottom: 8px;

    a {
      color: theme.$purple_3;
    }
  }
}

</style>
