<template>
  <div class="help-menu">
    <el-popover
      ref="helpMenu"
      v-model="menuOpen"
      popper-class="help-menu-popover no-padding"
      placement="right-end"
      trigger="hover"
      transition=""
      :open-delay="200"
      :width="260"
      :visible-arrow="false"
    >

      <template #reference>
        <button
          class="user-menu bf-navigation-item"
          :class="{ active: menuOpen }"
        >

          <IconHelpMessage
            class="icon-main"
            :width="20"
            :height="20"
            />

          <span v-if="!condensed" class="label">
            Get Help
          </span>
          <IconArrowRight
            :height="10"
            :width="10"
            />

        </button>

      </template>

      <div class="bf-menu">
        <ul>
          <li>
            <a
              class="bf-menu-item"
              href="#"
              @click.prevent="showIntercom"
            >
              Send Us a Message
            </a>
          </li>
          <li>
            <a
              class="bf-menu-item"
              href="http://docs.pennsieve.io/"
              target="_blank"
            >
              Documentation &amp; Tutorials
            </a>
          </li>
          <li>
            <a
              class="bf-menu-item"
              href="https://docs.pennsieve.io/reference"
              target="_blank"
            >
              Developer Documentation
            </a>
          </li>
          <li>
            <a
              class="bf-menu-item"
              href="https://docs.pennsieve.io/changelog"
              target="_blank"
            >
              Recent Updates
            </a>
          </li>
        </ul>
      </div>
    </el-popover>

  </div>
</template>

<script>
import { mapGetters } from 'vuex'

import EventBus from '../../../utils/event-bus'
import IconHelpMessage from '../../icons/IconHelpMessage.vue'
import IconArrowRight from "../../icons/IconArrowRight.vue";

export default {
  name: 'HelpMenu',

  props: {
    condensed: {
      type: Boolean,
      default: false
    },
  },

  components: {
    IconArrowRight,
    IconHelpMessage
  },

  data() {
    return {
      menuOpen: false
    }
  },

  computed: {
    ...mapGetters([
      'hasFeature'
    ]),
  },

  mounted() {
    EventBus.$on('open-getting-started', this.showUserMenu.bind(this))
  },

  beforeUnmount() {
    EventBus.$off('open-getting-started', this.showUserMenu.bind(this))
  },

  methods: {
    /**
     * Show the user menu
     */
    showUserMenu: function() {
      this.menuOpen = true
    },

    /**
     * Show intercom window
     */
    showIntercom: function() {
      // window.Intercom('show')
      this.menuOpen = false
    }
  }
}
</script>

<style lang="scss" scoped>
.help-menu-popover {
  margin-left: 8px !important;
}
</style>
