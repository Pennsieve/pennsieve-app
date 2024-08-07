<template>
  <div class="banner-wrapper" v-if="!isDismissed">
    <div v-if="showBanner" class="banner">
      <span />
      <div>
        {{ copy }}
        <a :href="getUrl" target="_blank">{{ linkText }}</a>
      </div>

      <IconRemove
        @click="handleClose"
        class="close-btn"
        :height="12"
        :width="12"
      />
    </div>
  </div>
</template>

<script>
import IconRemove from "../../icons/IconRemove.vue";
import { mapState } from "vuex";
import { ref } from "vue";
import Cookies from "js-cookie";

export default {
  name: "AnnouncementBanner",
  props: {
    copy: {
      type: String,
      default: "",
    },
    linkText: {
      type: String,
      default: "",
    },
    /**
     * Please pass a unique cookie name to each instance of the Announcment Banner Component.
     * **/
    cookieName: {
      type: String,
      default: "",
    },
    url: {
      type: String,
      default: "",
    },
  },

  setup(props) {
    const showBanner = ref(true);
    const isDismissed = ref(Cookies.get(`${props.cookieName}`));
    function handleClose() {
      showBanner.value = false;
      Cookies.set(`${props.cookieName}`, "true");
    }

    return {
      isDismissed,
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
      if (this.cookieName === "vueMigrationBanner") {
        return this.config.environment === "prod"
          ? "https://app2.pennsieve.io"
          : "https://app2.pennsieve.net";
      } else return this.url;
    },
  },

  components: { IconRemove },

  methods: {
    toggleVisible: function (val) {
      this.visible = val;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../../assets/_variables";

.banner-wrapper {
  background-color: $purple_3;
}

.banner {
  background-color: $purple_tint;
  border: 1px solid $purple_2;
  margin: 5px;
  padding: 8px 0 8px 0;
  color: $purple_2;
  display: flex;
  font-weight: bold;
  justify-content: space-between;
  text-align: center;

  a {
    color: $purple_2;
    text-decoration: underline;
  }
}

.close-btn {
  margin-right: 20px;
  cursor: pointer;
}
</style>
