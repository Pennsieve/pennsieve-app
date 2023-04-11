<script setup>
import { mapGetters, mapState } from "vuex";
</script>

<template>
  <div id="app-wrap">
    <router-view name="header" />

    <div id="main-wrap">
      <router-view v-show="primaryNavOpen" name="navigation" />
      <router-view v-show="secondaryNavOpen" name="navigationSecondary" />
      <router-view id="page" name="page" />
    </div>
  </div>
  <!-- <header>
    <img
      alt="Vue logo"
      class="logo"
      src="@/assets/logo.svg"
      width="125"
      height="125"
    />

    <div class="wrapper">
      <HelloWorld msg="You did it!" />

      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about">About</RouterLink>
      </nav>
    </div>
  </header>

  <RouterView /> -->
</template>

<script>
export default {
  name: "app",
  computed: {
    ...mapState([
      "datasets",
      "primaryNavOpen",
      "secondaryNavOpen",
      "environment",
      "searchModalVisible",
      "isLinkOrcidDialogVisible",
    ]),
    ...mapGetters([
      "activeOrganization",
      "getActiveOrganization",
      "config",
      "userToken",
      "hasFeature",
      "hasOrcidOnboardingEvent",
      "isOrgSynced",
    ]),
  },
};
</script>

<style lang="scss">
@import "./assets/_variables.scss";

html,
body {
  font-family: $system-font;
  font-size: 14px;
  line-height: 17px;
}

body {
  background-color: $gray_1;
  color: $text-color;
  margin: 0;
  min-height: 100vh;
}
// Hide only visually, but have it available for screenreaders: h5bp.com
.visually-hidden {
  border: 0;
  clip: rect(0 0 0 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  width: 1px;
}

.login-form {
  @extend .visually-hidden;
}

#app-wrap {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}

#main-wrap {
  display: flex;
  flex: 1;
  flex-direction: row;
  overflow: hidden;
}

#page {
  flex: 1;
  overflow: auto;
}
</style>
