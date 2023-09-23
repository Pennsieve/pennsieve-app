<template>
    <div :class="logoWrapClass">
      <template v-if="showPennLogo">
        <img
          v-if="darkBackground && !markOnly"
          src="../../../assets/images/Upenn_FullLogo_Reverse_RGB.png"
          alt="University of Pennsylvania"
          :class="pennLogoClass"
        />
        <img
          v-else-if="!darkBackground && !markOnly"
          src="../../../assets/images/Upenn_FullLogo_RGB.png"
          alt="University of Pennsylvania"
          :class="pennLogoClass"
        />
        <img
          v-else-if="darkBackground && markOnly"
          src="../../../assets/images/UPenn_Shield_RGB.png"
          alt="University of Pennsylvania"
          :class="pennLogoClass"
        />
        <img
          v-else
          src="../../../assets/images/UPenn_Shield_RGB.png"
          alt="University of Pennsylvania"
          :class="pennLogoClass"
        />
      </template>

      <template v-if="showPennsieveLogo">
        <PennsieveLogo v-if="!markOnly" :class="pennsieveLogoClass"/>
        <PennsieveMark v-else :class="pennsieveMarkClass"/>
      </template>
      <template v-else>
        <div class="pennsieve-title dark-background">
          <div>
            Pennsieve Platform <i>for</i>
          </div>
          <div>Data Management </div>
        </div>
      </template>
    </div>
</template>

<script>
import PennsieveLogo from "../../icons/IconPennsieveLogo.vue";
import PennsieveMark from "../../icons/IconPennsieveMark.vue";

export default {
  name: "PennsieveLogoContainer",

  components: {
    PennsieveMark,
    PennsieveLogo,
  },

  props: {
    showPennLogo: {
      type: Boolean,
      default: true
    },
    showPennsieveLogo: {
      type: Boolean,
      default: true
    },
    stacked: {
      type: Boolean,
      default: false
    },
    markOnly: {
      type: Boolean,
      default: false
    },
    darkBackground: {
      type: Boolean,
      default: false
    },
    color: {
      type: String,
      default: "currentColor",
    },
  },

  data() {
    return {
    };
  },

  computed: {
    pennsieveLogoClass: function() {
      if (this.showPennLogo) {
        return this.darkBackground? "pennsieve-logo dark-background" : "pennsieve-logo "
      } else {
        return this.darkBackground? "pennsieve-logo dark-background no-penn-logo" : "pennsieve-logo no-penn-logo"

      }
    },
    pennsieveMarkClass: function() {
      return this.darkBackground? "pennsieve-mark dark-background" : "pennsieve-mark"
    },
    logoWrapClass: function() {
      return this.stacked? "logo-wrap stacked" : "logo-wrap"
    },
    pennLogoClass: function() {
      if (this.markOnly){
        if (this.darkBackground) {
          return this.stacked? "penn-mark dark-background stacked" : "penn-mark dark-background"
        } else {
          return this.stacked? "penn-mark stacked" : "penn-mark"

        }
      } else {
        if (this.darkBackground) {
          return this.stacked? "penn-logo dark-background stacked" : "penn-logo dark-background"
        } else {
          return this.stacked? "penn-logo stacked" : "penn-logo"

        }
      }

    }
  },

  methods: {
  },
};
</script>

<style scoped lang="scss">
@import "../../../assets/_variables.scss";

.pennsieve-title {
  font-family: 'EB Garamond', serif;
  margin-left: 8px;
  width: 60%;
  font-size: 18px;
  color: $purple_3;

  &.dark-background {
    color: white;
  }
}

.penn-mark {
  padding-right: 4%;
  width: 46%;
}

.penn-logo {
  border-right: 1px solid $purple_3;
  padding-right: 8px;
  width: 40%;

  &.stacked {
    border: none;
    margin-bottom: 8px;
  }

  &.dark-background {
    border-right: 1px solid white;
  }
}

.pennsieve-mark {
  padding-left: 4%;
  width: 46%;
  color: $purple_3;

  &.dark-background {
    color: white;
  }
}

.pennsieve-logo {
  margin-left: 8px;
  margin-top: 4px;
  width: 60%;
  color: $purple_3;

  &.dark-background {
    color: white;
  }

  & .no-penn-logo {
    margin-left: 0;
  }
}

.logo-wrap {
  align-items: center;
  display: flex;
  flex-shrink: 0;
  margin: 8px 0;

  &.stacked {
    flex-direction: column;
  }
}

</style>