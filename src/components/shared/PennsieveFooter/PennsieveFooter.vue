<template>
  <div class="bf-footer">
    <div class="footer-container">
      <div class="container-fluid discover-content">
        <div class="row">
          <div class="col-xs-12">
            <PennsieveLogoContainer class="logo-container" :mark-only="true" :dark-background="true"/>

<!--            <IconPennsieveMark-->
<!--                class="mb-16"-->
<!--                :width="35"-->
<!--                :height="35"-->
<!--                color="#fff"-->
<!--            />-->
            <p class="mb-8">
              Copyright &copy; {{ copyrightYear }} University of Pennsylvania.
              All rights reserved.
            </p>
            <ul class="footer-text footer-links unstyled">
              <li>
                <a href="https://docs.pennsieve.io/page/pennsieve-terms-of-use" target="_blank">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="https://docs.pennsieve.io/page/privacy-policy" target="_blank">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="https://docs.pennsieve.io/" target="_blank">
                  Documentation Hub
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import BfButton from '../bf-button/BfButton.vue'
import IconPennsieveMark from "../../icons/IconPennsieveMark.vue"
import PennsieveLogoContainer from "../PennsieveLogoContainer/PennsieveLogoContainer.vue";


export default {
  name: 'PennsieveFooter',

  components: {
    PennsieveLogoContainer,
    BfButton,
    IconPennsieveMark
  },

  props: {
  },

  computed: {
    /**
     * Returns the copyright year for the footer
     * @returns {String}
     */
    copyrightYear() {
      return new Date().getFullYear()
    }
  }
}
</script>

<style lang="scss" scoped>
@use '../../../styles/theme';

.bf-footer {
  display: block;
  font-size: 13px;
  z-index: 2;

  .logo-container {
    width: 60px;
  }

  .buttons {
    display: flex;

    @media (max-width: 48em) {
      margin-top: 32px;
    }

    @media (min-width: 48em) {
      justify-content: flex-end;
    }

    .learn-button {
      height: 48px;
      width: 130px;
      border: 2px solid theme.$gray_1;
      border-radius: 3px;
      font-size: 16px;
      font-weight: 500;
      line-height: 32px;
      background-color: transparent;
      padding: 0;

      &:hover {
        background-color: theme.$purple_2;
        border: 2px solid theme.$purple_2;
      }

      &:focus {
        background-color: theme.$purple_3;
        border: 2px solid theme.$purple_3;
      }

      a {
        color: theme.$gray_1;
        text-decoration: none;
      }
    }
  }

  p {
    color: theme.$gray_1;
    font-size: 14px;
    line-height: 24px;
  }

  .footer-container {
    padding: 32px 0 48px;
    background: theme.$gray_4;
  }

  .footer-text {
    color: theme.$gray_1;
  }
}

.container-fluid {
  margin: 0 40px;
}

.footer-links {
  display: flex;
  li {
    &:before {
      content: '|';
    }
    &:first-child {
      margin: 0;

      &:before {
        content: '';
      }

      a {
        padding-left: 0;
      }
    }
  }

  a {
    color: theme.$gray_1;
    font-size: 14px;
    line-height: 16px;
    padding: 0 4px;
    text-decoration: underline;

    &:visited,
    &:active,
    &:hover,
    &:focus {
      color: theme.$gray_2;
    }
    &:hover,
    &:focus {
      text-decoration: none;
    }
  }
}

a {
  color: theme.$gray_2;
}

a:hover {
  color: theme.$primary-color;
}
</style>
