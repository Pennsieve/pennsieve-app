<template>
  <div class="create-button-wrapper">
    <locked-dialog
      :dialog-visible="visible"
      @close="toggleVisible"
    />

    <el-popover
      ref="createMenu"
      v-model="createMenuOpen"
      :popper-class="createPopoverClass"
      width="260"
      trigger="click"
      :show-arrow="false"
    >
      <template #reference>
        <div
          id="create-button"
          class="bf-navigation-item"
          :class="{ 'open' : createMenuOpen }"
        >
          <div class="icon-action">
            <img
              v-if="datasetLocked"
              src="../../../assets/images/icons/lock-create.svg"
              alt="icon for locked dataset"
            >

            <IconAddItem/>

            <div class="" v-show="!condensed">
            <span
              v-if="datasetLocked"
              class="label"
            >
              View Only
            </span>
              <span
                v-else
                class="label"
              >
              Create
            </span>
            </div>
          </div>

          <IconArrowUp
            class="icon-arrow"
            :class="[ createArrowDir === 'down' ? 'svg-flip' : '' ]"
            :width="10"
            :height="10"
          />
        </div>
      </template>

      <template v-if="datasetLocked">
          <p class="locked-copy">
            {{ datasetLockedMessage }}
          </p>
          <a
            v-if="dataset.publication.type === PublicationType.EMBARGO"
            href="#"
            @click.prevent="toggleVisible(true)"
          >
            <IconHelpMessage
              class="mr-8"
              icon="icon-help-message"
              :height="15"
              :width="15"
            />
            Tell Me More
          </a>
          <a
            v-else
            href="#"
            target="_blank"
            @click.prevent="showIntercom"
          >
            Get Help
          </a>
        </template>

      <template v-else>
          <div class="bf-menu">
            <template v-if="getPermission('editor')">
              <ul v-show="hasConcepts">
                <li>
                  <el-popover

                    ref="recordMenu"
                    v-model="recordMenuOpen"
                    popper-class="new-record-menu scroll"
                    placement="right-start"
                    width="300"
                    trigger="hover"
                    :offset="0"
                    :show-after="100"
                    :show-arrow="false"
                    @hide="onRecordMenuHide"
                  >
                    <template #reference>
                      <a
                        class="bf-menu-item icon-item"
                        data-cy="newRecordBtn"
                        href="#"
                        @click.prevent
                      >
                        New Record
                        <IconArrowRight
                          :width="10"
                          :height="10"
                        />
                      </a>
                    </template>
                      <filter-input
                        v-show="showFilter"
                        ref="inputModelFilter"
                        v-model="modelFilter"
                        placeholder="Type an model name to filter"
                      />

                      <div class="bf-menu scroll-menu">
                        <ul>
                          <li
                            v-for="item in filteredConcepts"
                            :key="item.id"
                          >
                              <router-link
                                class="bf-menu-item"
                                :to="{
                                  name: 'metadata-record',
                                  params: {
                                    modelId: item.id,
                                    instanceId: 'new'
                                  }
                                }"
                                @click.native="closeMenus"
                              >
                            {{ item.displayName }}
                            </router-link>
                          </li>
                        </ul>
                      </div>

                      <filter-empty-state
                        v-if="filteredConcepts.length === 0"
                        class="filter-empty-state"
                      >
                        <h3>You don't have any records</h3>
                        <p>
                          Once you set up
                                    <router-link
                                      :to="{ name: 'models' }"
                                      class=""
                                    >
                                      models
                                    </router-link>
                          , you'll be able to create records.
                        </p>
                      </filter-empty-state>
                  </el-popover>

                </li>
              </ul>

              <hr v-show="hasConcepts">
            </template>

            <ul v-if="getPermission('editor')">
              <li>
                <a
                  class="bf-menu-item"
                  href="#"
                  @click.prevent="uploadFile"
                >
                  Upload File
                </a>
              </li>

            </ul>

            <template v-if="getPermission('manager')">
              <hr>

              <ul>
                <li>
                  <router-link
                    class="bf-menu-item"
                    :to="{
                      name: 'models',
                      query: {
                        openNewModelDialog: true
                      }
                    }"
                    @click.native="closeMenus"
                  >
                    New Model
                  </router-link>
                </li>
                <li v-if="modelTemplates.length > 0">
                  <router-link
                    class="bf-menu-item"
                    :to="{
                      name: 'model-templates'
                    }"
                    @click.native="closeMenus"
                  >
                    Model from Template
                  </router-link>
                </li>
                <li>
                  <router-link
                    class="bf-menu-item"
                    :to="{
                      name: 'relationships',
                      query: {
                        createRelationshipType: true
                      }
                    }"
                    @click.native="closeMenus"
                  >
                    Create Relationship Type
                  </router-link>
                </li>
              </ul>
            </template>


          </div>
        </template>
    </el-popover>


  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import { filter, propEq } from 'ramda'

import EventBus from '../../../utils/event-bus'
import FilterInput from '../../shared/FilterInput/FilterInput.vue'
import FilterEmptyState from '../../shared/FilterEmptyState/FilterEmptyState.vue'
import LockedDialog from '../../datasets/LockedDialog/LockedDialog.vue'
import { PublicationType } from '../../../utils/constants'
import { DatasetLockedMessaging } from '../../../utils/constants'
import IconArrowRight from "../../icons/IconArrowRight.vue";
import IconArrowUp from "../../icons/IconArrowUp.vue";
import IconHelpMessage from "../../icons/IconHelpMessage.vue";
import IconAddItem from "../../icons/IconAddItem.vue";


export default {
  name: 'CreateButton',

  components: {
    IconAddItem,
    IconHelpMessage,
    IconArrowUp,
    IconArrowRight,
    FilterInput,
    FilterEmptyState,
    LockedDialog
  },

  props: {
    condensed: Boolean
  },

  data() {
    return {
      createMenuOpen: false,
      recordMenuOpen: false,
      modelFilter: '',
      visible: false
    }
  },

  computed: {
    ...mapState([
      'dataset',
      'concepts',
      'modelTemplates'
    ]),

    ...mapGetters([
      'hasFeature',
      'getPermission',
      'datasetLocked'
    ]),


      /**
       * Dataset locked message based on dataset publication type
       * @returns {String}
       */
      datasetLockedMessage: function() {
        return this.dataset.publication.type === PublicationType.EMBARGO ? DatasetLockedMessaging.EMBARGO_LOCKED_MESSAGE :
        DatasetLockedMessaging.DEFAULT_LOCKED_MESSAGE
      },

    /**
     * Publication Type constant
     * @returns {String}
    */
    PublicationType: function() {
      return PublicationType
    },

    /**
     * Compute popover class based on locked dataset status
     * @returns {String}
     */
    createPopoverClass: function() {
      return this.datasetLocked ? 'create-menu dataset-locked' : 'create-menu no-padding'
    },

    /**
     * Compute if the org has unlocked concepts
     * @returns {Boolean}
     */
    hasConcepts: function() {
      return this.unlockedConcepts.length > 0
    },

    /**
     * Compute the direction of the create arrow icon
     * @returns {String}
     */
    createArrowDir: function() {
      return this.createMenuOpen ? 'up' : 'down'
    },

    /**
     * Compute if the filter should be shown
     * @returns {Boolean}
     */
    showFilter: function() {
      return this.unlockedConcepts.length >= 20
    },

    /**
     * Compute list of all unlocked concepts
     * @returns {Array}
     */
    unlockedConcepts: function() {
      return filter(propEq('locked', false), this.concepts)
    },

    /**
     * Compute concepts based off of filter
     * @return {Array}
     */
    filteredConcepts: function() {
      if (this.unlockedConcepts.length) {
        return this.unlockedConcepts.filter(concept => {
          return concept.displayName.toLowerCase().indexOf(this.modelFilter.toLowerCase()) > -1 && concept.propertyCount > 0
        })
      }

      return []
    }
  },

  methods: {

    /**
     * Toggles modal to be visible or not
     * @param {Boolean} val
     */
    toggleVisible: function(val) {
      this.visible = val
      if (this.createMenuOpen) {
        this.createMenuOpen = false
      }
    },
    /**
     * Compute placement for create menu
     * @param {Object}
     * @returns {Object}
     */
    createMenuModifier: function(data) {
      // Compute offset
      if (this.condensed) {
        const condensedOffset = 41
        data.offsets.popper.top += condensedOffset
      } else {
        data.offsets.popper.left += 38
      }

      // Compute placement
      const placement = this.condensed ? 'right-start' : 'bottom-start'
      data.instance._options.placement = placement

      return data
    },

    /**
     * Show intercom window
     */
    showIntercom: function() {
      // window.Intercom('show')
      this.createMenuOpen = false
    },

    /**
     * Close all menus
     */
    closeMenus: function() {
      this.createMenuOpen = false
      this.recordMenuOpen = false
    },

    /**
     * Open file upload window
     */
    uploadFile: function() {
      this.closeMenus()

      EventBus.$emit('open-uploader', true)

      // Update upload location
      this.$store.dispatch('updateUploadDestination', this.dataset)
    },
    //
    // /**
    //  * Open link to external file window
    //  */
    // linkToExternalFile: function() {
    //   this.closeMenus()
    //
    //   EventBus.$emit('open-external-file-modal')
    // },

    /**
     * Callback for when the record menu is hidden
     * Use `setTimeout` rather than nextTick to ensure
     * the menu is hidden before resetting
     */
    onRecordMenuHide: function() {
      window.setTimeout(() => {
        this.modelFilter = ''
      }, 250)
    }
  }
}
</script>

<style lang="scss" scoped>
  @use '../../../styles/theme';
  @use '../../../styles/bfmenu';

  .icon-action {
    display:flex;
    flex-direction: row;
    align-items: center;
  }

  .create-button-wrapper {
    font-size: 14px;
  }

  .bf-navigation-item {
    justify-content: space-between;
    cursor: pointer;
    &:hover, &:focus, &.open {
      background: none;
      #create-button-icon {
        color: theme.$app-primary-color;
      }
    }
    .svg-icon.icon-arrow {
      margin-right: 0;
      min-width: 0;
    }
  }


  #create-button-icon {
    color: theme.$gray_6;
    flex-shrink: 0;
    height: 28px;
    margin: -2px;
    width: 28px;
    .condensed & {
      margin: -4px
    }
  }

  #create-button {
    color: theme.$gray_6;
    display: flex;
    width: 100%;
    display: flex;
    align-items: center;

    .label {
      margin-left: 20px;
      text-align: initial;
      font-size: 14px;
    }
  }
  .locked-copy {
    color: #000
  }

  .filter-empty-state {
    h3 {
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 8px;
    }
    p {
      margin: 0;
    }
  }

  .new-record-menu {
    margin-left: 0;
    padding: 4px;
  }
  .create-menu.el-popover {
    box-sizing: border-box;
    margin-top: 16px;
  }
  .create-menu.dataset-locked {
    padding: 24px 16px;
    text-align: center;
    p {
      font-size: 13px;
    }
    a {
      align-items: center;
      display: flex;
      justify-content: center;
    }
  }
</style>
