<template>
  <div v-if="showBanner" class="locked-banner">
    <span />
    <div>
      Welcome to the new Pennsieve App experience! If you would like to access
      the previous version, it's still available. Just click
      <a :href="getUrl" target="_blank">here.</a>
    </div>

    <IconRemove
      @click="handleClose"
      class="close-btn"
      :height="12"
      :width="12"
      color="white"
    />
  </div>
</template>

<script>
import IconRemove from "../../icons/IconRemove.vue";
import { mapState } from "vuex";
import { ref } from "vue";
import Cookies from "js-cookie";

export default {
  setup() {
    const showBanner = ref(true);
    function handleClose() {
      showBanner.value = false;
    }

    return {
      handleClose,
      showBanner,
    };
  },
  computed: {
    ...mapState(["config"]),
    /**
     * Returns link to previous version of Pennsieve App
     * @returns {String}
     */
    getUrl: function () {
      return this.config.environment === "prod"
        ? "https://app2.pennsieve.io"
        : "https://app2.pennsieve.net";
    },
  },

  components: { IconRemove },

  data() {},

  methods: {
    toggleVisible: function (val) {
      this.visible = val;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../../assets/_variables";

.locked-banner {
  background-color: $purple_2;
  padding: 8px 0 8px 0;
  color: white;
  display: flex;
  font-weight: bold;
  justify-content: space-between;
  text-align: center;

  a {
    color: white;
    text-decoration: underline;
  }
}

.close-btn {
  margin-right: 20px;
}
</style>
