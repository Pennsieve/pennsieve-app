<template>
  <div class="applications-list-item">
    <el-row class="info">
      <div class="application-title">
        {{ application.name }}
      </div>
    </el-row>
    <el-row>
      <p class="application-description">
        {{ application.description }}
      </p>
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
  name: "IntegrationListItem",

  components: {
    IconMenu,
    Avatar,
  },
  mixins: [FormatDate],

  props: {
    application: {
      type: Object,
      default: () => ({}),
    },
  },

  computed: {},

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
  methods: {
    ...mapActions(["updateDataset"]),
  },
};
</script>

<style scoped lang="scss">
@import "../../../assets/_variables.scss";

.applications-list-item {
  width: 230px;
  height: 300px;
  border: 1px solid $gray_3;
  margin: 0 8px 16px 8px;
  background-color: white;
  display: flex;
  flex-direction: column;
}

.application-title {
  font-size: 16px;
  margin: 16px 4px;
  color: black;
  text-align: center;
}

.application-description {
  font-size: 14px;
  color: $gray_5;
  min-height: 3em;
  max-width: 500px;
  margin: 8px;
  overflow-wrap: break-word;
}

.info {
  background: $purple_tint;
  padding: 8px;
}
</style>
