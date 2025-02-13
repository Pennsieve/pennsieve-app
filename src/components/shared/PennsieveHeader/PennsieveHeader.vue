<template>
  <div class="pennsieve-header">
    <PennsieveLogoContainer
      class="logo-container"
      :dark-background="true"
      :show-pennsieve-logo="false"
    />

    <div class="nav-links">
      <a
        v-if="isMobile && isSearchVisible"
        class="mr-16"
        href="#"
        @click.prevent="toggleSearch"
      >
        <IconRemove
          :class="iconSpacing"
          :width="mobileSearchIconSize"
          color="white"
        />
      </a>
      <a href="https://docs.pennsieve.io" target="_blank" class="mr-16">
        <IconHelp :class="iconSpacing" :height="22" :width="22" />
        {{ helpLinkCopy }}
      </a>
      <a target="_blank" class="mr-16" @click="openContactUsDialog">
        <IconInfo :class="iconSpacing" :height="22" :width="22" />
        Contact Us
      </a>
      <router-link tag="a" class="mr-16" :to="signupRoute">
        <IconUpload :class="iconSpacing" :height="22" :width="22" />
        {{ createAccountCopy }}
      </router-link>
      <bf-user-dropdown-menu
        :is-mobile="isMobile"
        :icon-spacing="iconSpacing"
        @open-log-in-modal="openLogInModal"
      />
    </div>
    <ps-log-in-dialog
      v-model:visible="isLogInModalVisible"
      :is-mobile="isMobile"
      @succesfulLogin="loginUser"
      @close-log-in-dialog="closeLogInModal"
    />
    <contact-us-dialog />
  </div>
</template>

<script>
import { mapState } from "vuex";
import IconHelp from "../../icons/IconHelp.vue";
import IconRemove from "../../icons/IconRemove.vue";
import PennsieveLogo from "../../icons/IconPennsieveLogo.vue";
import IconUpload from "../../icons/IconUpload.vue";
import IconInfo from "../../icons/IconInfo.vue";
import EventBus from "../../../utils/event-bus";

// import DatasetSearch from "@/components/DatasetSearch/DatasetSearch.vue";
import PsLogInDialog from "../PsLoginDialog/PsLogInDialog.vue";
import BfUserDropdownMenu from "../../shared/BfUserDropdownMenu/BfUserDropdownMenu.vue";
import PennsieveLogoContainer from "../PennsieveLogoContainer/PennsieveLogoContainer.vue";
import ContactUsDialog from "./contact-us-dialog/ContactUsDialog.vue";

export default {
  name: "PennsieveHeader",

  components: {
    PennsieveLogoContainer,
    PennsieveLogo,
    IconRemove,
    IconHelp,
    IconUpload,
    PsLogInDialog,
    BfUserDropdownMenu,
    ContactUsDialog,
  },

  props: {
    isSearchVisible: {
      type: Boolean,
      default: true,
    },
  },

  data() {
    return {
      isMobileSearchOpen: false,
      isLogInModalVisible: false,
      isContactUsDialogOpen: false,
      displayName: "",
      windowWidth: "",
    };
  },

  computed: {
    ...mapState(["profile", "userDisplayName"]),

    btnMobileSearchIcon() {
      return this.isMobileSearchOpen ? "icon-remove" : "icon-magnifying-glass";
    },

    /**
     * Conditional size for mobile search icon button
     * @returns {number}
     */
    mobileSearchIconSize() {
      return this.isMobileSearchOpen ? 16 : 24;
    },

    /**
     * True if the user is on mobile (or small screen)
     * @returns {Boolean}
     */
    isMobile() {
      return this.windowWidth <= 768;
    },

    /**
     * Copy for help button, display nothing if
     * on mobile
     * @returns {String}
     */
    helpLinkCopy() {
      return this.isMobile ? "" : "Documentation";
    },

    createAccountCopy() {
      return this.isMobile ? "" : "Create Account";
    },
    /**
     * Conditional icon spacing for mobile
     * @returns {String}
     */
    iconSpacing() {
      // TODO: “The mr-4 class isn’t applying the correct right margin. Our current styling in _spacing.scss allows for mr-0, mr-8, mr-16, and similar values, but not for mr-4. To apply margin-right: 4px, a different method should be used.”
      return this.isMobile ? "mr-4" : "mr-8";
    },

    /**
     * Compute what route the logo should
     * take the user based on their organization
     * @returns {Object}
     */
    signupRoute: function () {
      let routeName = "create-account";

      return {
        name: routeName,
        params: {},
      };
    },
  },

  mounted() {
    const query = this.$route.query;
    if ("redirectTo" in query) {
      this.isLogInModalVisible = true;
    }
  },
  beforeMount() {
    // Setup resize event listener
    this.windowWidth = window.innerWidth;
    window.onresize = () => this.onResize(window.innerWidth);
  },
  methods: {
    /**
     * Toggle search and focus
     * Timeout is used so the input focuses
     * after the transition
     */
    toggleSearch() {
      this.isMobileSearchOpen = !this.isMobileSearchOpen;

      if (this.isMobileSearchOpen) {
        window.setTimeout(() => {
          this.$refs.datasetSearch.focus();
        }, 200);
      }
    },

    loginUser(user) {
      this.$emit("onLogin", user);
    },

    /**
     * Display log in modal
     */
    openLogInModal() {
      this.isLogInModalVisible = true;
    },

    /**
     * Hide log in modal
     */
    closeLogInModal() {
      this.isLogInModalVisible = false;
    },
    /**
     * Display Contact us dialog
     */
    openContactUsDialog() {
      EventBus.$emit("isContactUsDialogOpen", true);
    },

    /**
     * Resize event listener
     * @param {Number} width
     */
    onResize(width) {
      this.windowWidth = width;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../../assets/_variables.scss";

.pennsieve-header {
  align-items: end;
  padding-bottom: 8px;
  box-sizing: border-box;
  display: flex;
  height: 72px;
  background-color: $purple_3;
  padding-right: 20px;
  position: relative;
  width: 100%;

  a {
    cursor: pointer;
  }
}
.logo-wrap {
  align-items: center;
  display: flex;
  flex-shrink: 0;

  .penn-logo {
    border-right: 1px solid white;
    margin-left: 8px;
    padding: 0 8px;
    width: 100px;
  }

  .pennsieve-logo {
    margin-left: 8px;
    margin-top: 4px;
    color: white;
    width: 150px;
  }
}
#btn-home {
  height: 64px;
  width: 64px;
  background-color: $purple_2;
}
.header-title {
  color: #ffffff;
  font-size: 22px;
  line-height: 21px;
  display: inline;
  margin-left: 16px;
  &:hover {
    text-decoration: none;
  }
}

.nav-links {
  flex-shrink: 0;
  margin-left: auto;
  a {
    color: white;
    display: inline-block;
    flex-shrink: 0;
    font-size: 14px;
    font-weight: 400;
  }
}
.header-content {
  display: flex;
  width: 100%;
  justify-content: space-between;
}

.blackfynn-title {
  font-family: "SharpSans";
  font-weight: 500;
  margin-right: 3px;
}
.discover-title {
  font-family: "SharpSansLight";
  font-weight: 100;
}

.dataset-search {
  @media (max-width: 48em) {
    background: $purple_1;
    box-sizing: border-box;
    flex: 1;
    margin: 0;
    padding: 12px 0 12px 12px;
    transform: translateX(100vw);
    transition: 0.2s cubic-bezier(0.4, 0, 1, 1) transform;
    .mobile-search-open & {
      transform: translateX(0);
    }
  }
  :deep(.bf-button) {
    @media (max-width: 48em) {
      display: none;
    }
  }
  :deep(.dataset-search-input) {
    @media (max-width: 48em) {
      margin: 0;
    }
  }
}
.dataset-search-wrap {
  overflow: hidden;
  margin: 0 24px;
  max-width: 709px;
  width: 100%;
  @media (max-width: 48em) {
    display: flex;
    margin: 0;
    max-width: none;
    position: absolute;
    top: 0;
    width: 65%;
  }
}

.btn-mobile-search {
  display: none;
  padding: 8px 12px 8px 8px;
  @media (max-width: 48em) {
    display: block;
  }

  .mobile-search-open & svg {
    box-sizing: border-box;
    padding: 4px;
  }
}

.logo-container {
  width: 300px;
  margin-left: 24px;
}
</style>
