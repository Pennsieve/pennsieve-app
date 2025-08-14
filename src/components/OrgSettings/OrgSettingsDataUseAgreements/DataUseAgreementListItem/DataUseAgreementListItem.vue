<template>
  <slat-info class="data-use-agreement">
    <div>
      <button
        class="linked"
        type="button"
        @click="isDialogVisible = true"
      >
        <span
          v-if="dataUseAgreement.isDefault"
          class="default-dot"
        />
        {{ dataUseAgreement.name }}
      </button>
      <p>{{ dataUseAgreement.description }}</p>
    </div>
    <el-dropdown
      v-if="!dataUseAgreement.isDefault"
      slot="info"
      class="ml-16"
      trigger="click"
      placement="bottom-end"
      @command="onMenuSelect"
    >
      <button class="el-dropdown-link">
        <IconMenu
          :height="20"
          :width="20"
          />
      </button>
      <template #dropdown>
        <el-dropdown-menu
          slot="dropdown"
          class="bf-menu"
          :offset="9"
        >
          <el-dropdown-item command="make-default">
            Make Default
          </el-dropdown-item>
          <el-dropdown-item command="edit">
            Edit
          </el-dropdown-item>
          <el-dropdown-item command="delete">
            Delete
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <data-use-agreement-dialog
      :dialog-visible="isDialogVisible"
      :data-use-agreement="dataUseAgreement"
      @close="closeAgreementDialog"
    />
  </slat-info>
</template>

<script>
import SlatInfo from '../../../shared/SlatInfo/SlatInfo.vue'
import DataUseAgreementDialog from '../../../shared/DataUseAgreementDialog/DataUseAgreementDialog.vue'
import IconMenu from "../../../icons/IconMenu.vue";

export default {
  name: 'DataUseAgreementListItem',

  components: {
    IconMenu,
    DataUseAgreementDialog,
    SlatInfo
  },

  props: {
    dataUseAgreement: {
      type: Object,
      default: () => {
        return {
          name: '',
          description: '',
          body: '',
          id: '',
          isDefault: false
        }
      }
    }
  },

  data() {
    return {
      isDialogVisible: false
    }
  },

  methods: {
    /**
     * When the user selects an option from
     * the menu, emit an event
     */
    onMenuSelect: function(command) {
      this.$emit(command, this.dataUseAgreement)
    },
    closeAgreementDialog: function() {
      this.isDialogVisible = false
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../../../../assets/_variables.scss';

p {
  color: $gray_4;
}
button {
  align-items: center;
  display: flex;
}
.slat-info.data-use-agreement {
  align-items: center;
  padding: 16px 0;
}
.default-dot {
  background: $green_1;
  border-radius: 50%;
  height: 8px;
  margin-right: 4px;
  width: 8px;
}
</style>
