<template>
  <div class="integration-list-item">
    <el-row type="flex" class="info">
      <el-col :sm="16">
        <div class="integration-type">
          {{ isPrivateStr }}
        </div>
      </el-col>
      <el-col :sm="8" v-if="enableSwitch" class="activeSwitch">
        <el-switch
          v-model="isActive"
          active-color="#5039F7"
          inactive-color="#CAC5BF"
          @change="toggleActive"
        >
        </el-switch>
      </el-col>
      <el-col :sm="8" class="integration-menu" v-else>
        <el-dropdown
          class="options-icon"
          trigger="click"
          placement="bottom-end"
          v-if="isAdmin"
          @command="onIntegrationMenu"
        >
          <span class="btn-file-menu el-dropdown-link">
            <IconMenu :height="20" :width="20" />
          </span>
          <template #dropdown>
            <el-dropdown-menu slot="dropdown" class="bf-menu" :offset="9">
              <el-dropdown-item command="openEditDialog">
                Edit integration
              </el-dropdown-item>
              <el-dropdown-item command="openDeleteDialog">
                Remove integration
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-col>
    </el-row>
    <el-row>
      <div class="integration-title">
        {{ integration.displayName }}
      </div>
    </el-row>
    <el-row>
      <p class="integration-description">
        {{ integration.description }}
      </p>
    </el-row>
    <el-row class="userIcon">
      <avatar class="icon condensed" :user="user" />
    </el-row>
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
    isPrivateStr: function () {
      if (this.integration.isPrivate) {
        return "PRIVATE";
      }
      return "PUBLIC";
    },
    user: function () {
      return find(propEq("intId", this.integration.createdBy), this.orgMembers);
    },
    created: function () {
      return this.formatDate(this.integration.createdAt);
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
      integrationEdit: {
        type: Object,
        default: function () {
          return {};
        },
      },
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
@import "../../../assets/_variables.scss";

.integration-menu {
  width: 24px;
}

.integration-list-item {
  width: 230px;
  height: 300px;
  border: 1px solid $gray_3;
  //margin: 0 0 16px 0;
  margin: 0 8px 16px 8px;
  //padding:  16px 24px 8px 24px;
  background-color: white;
  display: flex;
  flex-direction: column;
}
.info {
  background: $purple_tint;
  padding: 8px 16px;
  height: 64px;
  align-items: center;
}

.integration-title {
  font-size: 16px;
  margin: 16px 4px;
  color: black;
  text-align: center;
}

.integration-type {
  color: $gray_5;
  font-weight: 500;
  font-size: 12px;
}

.activeSwitch {
  text-align: end;
}

.integration-description {
  font-size: 14px;
  color: $gray_5;
  min-height: 3em;
  max-width: 500px;
  margin: 0 8px;
  overflow-wrap: break-word;
}

.list-item-col-spacer {
  padding-top: 32px;
}

.options-icon {
  float: right;
}

.userIcon {
  /* bottom: 0; */
  height: 100%;
  /* right: 0; */
  /* place-self: flex-end; */
  align-self: self-end;
  /* flex-direction: column; */
  display: flex;
  flex-direction: column-reverse;
  margin: 8px;
}
</style>
