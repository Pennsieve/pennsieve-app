<script setup>
import * as config from "@/site-config/site.json";
import PennsieveLogoContainer from "@/components/shared/PennsieveLogoContainer/PennsieveLogoContainer.vue";
import IconLock from "@/components/icons/IconLock.vue";

const environmentName = config.environmentName;
</script>

<template>
  <div class="auth-layout">
    <div class="auth-column">
      <div class="auth-card">
        <PennsieveLogoContainer stacked :show-penn-logo="false" />
        <div v-if="environmentName" class="auth-environment-badge">
          <IconLock :is-locked="true" :width="16" :height="16" color="currentColor" />
          <span>{{ environmentName }}</span>
        </div>
        <slot />
      </div>
      <slot name="below" />
    </div>
  </div>
</template>

<!-- Unscoped: these classes style content that the pages pass in through the slots. -->
<style lang="scss">
@use "../../../styles/theme";

.auth-layout {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 16px;
  box-sizing: border-box;
  background: theme.$purple_3;

  .auth-column {
    width: 360px;
    max-width: 100%;
  }

  .auth-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 32px;
    box-sizing: border-box;
    background: theme.$white;
    border-radius: 4px;
  }

  .auth-environment-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    align-self: center;
    margin-top: 8px;
    padding: 4px 16px;
    border-radius: 3px;
    background: theme.$purple_tint;
    color: theme.$purple_3;
    font-weight: 500;
    font-size: 14px;
  }

  .auth-content {
    display: flex;
    flex-direction: column;
    text-align: center;
  }

  .auth-title {
    margin: 24px 0 0 0;
    color: theme.$purple_3;
    font-size: 20px;
    line-height: 32px;
    font-weight: 700;
  }

  .auth-info {
    margin: 16px 0 0 0;
    line-height: 24px;
  }

  .auth-error {
    margin-top: 16px;
    padding: 8px;
    background: theme.$red_tint;
    color: theme.$red_2;
    text-align: left;
  }

  .auth-form {
    margin-top: 16px;
    text-align: left;

    .el-form-item {
      margin-bottom: 16px;
    }

    .el-form-item__label {
      line-height: 24px;
      margin-bottom: 8px;
    }

    .el-input {
      height: 40px;
    }
  }

  .auth-full-width {
    width: 100%;
  }

  .auth-secondary-link {
    margin-top: 16px;
  }

  .auth-below {
    margin: 16px 0 0 0;
    text-align: center;
    font-size: 14px;
    line-height: 24px;
    color: theme.$purple_0_7;

    a {
      color: theme.$white;
      text-decoration: underline;
    }

    & + .auth-below {
      margin-top: 8px;
    }
  }
}
</style>
