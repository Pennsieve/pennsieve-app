<template>
  <div class="integration-list-item">
    <div class="integration-info">
      <span class="integration-name">{{ integration.displayName }}</span>
      <span v-if="integration.isPrivate" class="integration-badge">Private</span>
      <span v-if="integration.description" class="integration-desc">{{ integration.description }}</span>
    </div>
    <div class="integration-actions">
      <el-switch
        v-if="enableSwitch"
        v-model="isActive"
        active-color="#17bb62"
        inactive-color="#CAC5BF"
        @change="toggleActive"
      />
      <el-dropdown
        v-else-if="isAdmin"
        class="options-icon"
        trigger="click"
        placement="bottom-end"
        @command="onIntegrationMenu"
      >
        <button class="menu-btn">
          <IconMenu :height="16" :width="16" />
        </button>
        <template #dropdown>
          <el-dropdown-menu class="bf-menu" :offset="9">
            <el-dropdown-item command="openEditDialog">
              Edit
            </el-dropdown-item>
            <el-dropdown-item command="openDeleteDialog">
              Remove
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script>
import { mapActions, mapState } from "vuex";
import { find, propEq } from "ramda";
import FormatDate from "../../../mixins/format-date";
import Avatar from "../../shared/avatar/Avatar.vue";
import IconMenu from "../../icons/IconMenu.vue";

export default {
  name: "IntegrationsListItem",

  components: {
    IconMenu,
    Avatar,
  },
  mixins: [FormatDate],

  props: {
    integration: {
      type: Object,
      default: () => ({}),
    },
    activeIntegrations: {
      type: Array,
      default: () => null,
    },
    enableSwitch: {
      type: Boolean,
      default: () => false,
    },
  },

  computed: {
    ...mapState(["orgMembers", "profile"]),
    isOwner: function () {
      return this.integration.createdBy == this.profile.intId;
    },
    isAdmin: function () {
      return this.isOwner;
    },
    user: function () {
      return find(propEq("intId", this.integration.createdBy), this.orgMembers);
    },
    userName: function () {
      if (this.user) {
        return this.user.firstName + " " + this.user.lastName;
      }
      return "";
    },
  },

  data: function () {
    return {
      isActive: false,
    };
  },
  mounted() {
    this.$nextTick(function () {
      if (this.enableSwitch) {
        this.isActive =
          find(
            propEq("webhookId", this.integration.id),
            this.activeIntegrations
          ) != null;
      }
    });
  },
  watch: {
    activeIntegrations: function () {
      if (this.enableSwitch) {
        this.isActive =
          find(
            propEq("webhookId", this.integration.id),
            this.activeIntegrations
          ) != null;
      }
    },
  },
  methods: {
    ...mapActions(["updateDataset"]),
    toggleActive: function () {
      this.$emit("toggle-integration", this);
    },
    openDeleteDialog: function (integration) {
      this.$emit("open-remove-integration", integration);
    },
    openEditDialog: function (integration) {
      this.$emit("open-edit-integration", integration);
    },
    onIntegrationMenu: function (action) {
      if (typeof this[action] === "function") {
        this[action](this.integration);
      }
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../styles/theme";

.integration-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: white;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: theme.$gray_3;
  }
}

.integration-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.integration-name {
  font-size: 14px;
  font-weight: 500;
  color: theme.$gray_6;
  white-space: nowrap;
}

.integration-badge {
  font-size: 11px;
  font-weight: 500;
  color: theme.$gray_4;
  background: theme.$gray_1;
  padding: 2px 8px;
  border-radius: 8px;
  flex-shrink: 0;
}

.integration-desc {
  font-size: 13px;
  color: theme.$gray_4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.integration-actions {
  flex-shrink: 0;
  margin-left: 16px;
}

.menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  color: theme.$gray_4;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: theme.$gray_1;
    color: theme.$gray_6;
  }
}
</style>
