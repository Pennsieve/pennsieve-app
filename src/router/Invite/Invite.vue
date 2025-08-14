<template>
  <div class="welcome-wrapper">



    <!--    <PennsieveMark-->
<!--      class="welcome-logo"-->
<!--      color="currentColor"-->
<!--      :width="40"-->
<!--      :height="40"-->
<!--    />-->

    <router-view name="stage" />
  </div>
</template>

<script>

import PennsieveMark from "../../components/icons/IconPennsieveMark.vue";
import PennsieveLogoContainer from "../../components/shared/PennsieveLogoContainer/PennsieveLogoContainer.vue";

  export default {
    name: 'Invite',
    components: {PennsieveLogoContainer, PennsieveMark},
  }
</script>

<style scoped lang="scss">
  @use '../../styles/theme';



  .welcome-wrapper {
     background: theme.$purple_1;

     .welcome-logo {
        color: theme.$purple_1;
        position: fixed;
        top: 20px;
        left: 20px;
       }
  }
</style>
