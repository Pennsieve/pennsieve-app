<template>
  <div>
    <el-row
      type="flex"
      class="member"
      align="middle"
      :gutter="1"
    >
      <el-col
        :sm="1"
        class="member-col info"
      >
          <IconArrowUp
            v-if="item.status !== 'Archived'"
            :class="[ showFiles  ? 'svg-flip' : '' ]"
            :height="12"
            :width="12"
            @click="toggleFiles"
            />

      </el-col>

      <el-col
        :sm="4"
        class="member-col info"
      >
        <avatar
          :user="getOrgMemberByIntId(item.user)"
          :tooltip="true"
        />
      </el-col>

      <el-col
        :sm="10"
        class="member-col"
      >
        {{ item.id }}
      </el-col>

      <el-col
        :sm="4"
        class="member-col col-spacer"
      >
      {{ formatDate(item.date_created*1000) }}
      </el-col>
      <el-col
        :sm="2"
        class="member-col col-spacer"
      >
      {{ item.status }}
      </el-col>
      <el-col
        :sm="3"
        class="member-col menu"
      >
        <el-dropdown
          trigger="click"
          placement="bottom-end"
          @command="handleCommand"
        >
          <span class="el-dropdown-link">
            <IconMenu
              name="icon-menu"
              :height="20"
              :width="20"
            />
          </span>
          <template #dropdown>
            <el-dropdown-menu
              slot="dropdown"
              :offset="9"
              class="bf-menu"
            >
              <el-dropdown-item
                command="download"
                class="bf-menu-item"
              >
                Download
              </el-dropdown-item>
              <el-dropdown-item
                command="archive"
                class="bf-menu-item"
              >
                Archive
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-col>
    </el-row>
    <div v-if="showFiles">
      <UploadManifestFiles

        :item="item"
      />
    </div>

  </div>

</template>

<script>
import Avatar from '../../../shared/avatar/Avatar.vue'
import Request from '../../../../mixins/request'
import { mapGetters, mapActions } from 'vuex'
import FormatDate from '../../../../mixins/format-date'
import UploadManifestFiles from "../UploadManifestFiles/UploadManifestFiles.vue";
import IconArrowUp from "../../../icons/IconArrowUp.vue";
import IconMenu from "../../../icons/IconMenu.vue";
import EventBus from '../../../../utils/event-bus'


export default {
  name: 'UploadManifest',

  components: {
    IconMenu,
    IconArrowUp,
    UploadManifestFiles,
    Avatar
  },

  mixins: [
    Request,
    FormatDate

  ],

  props: {
    item: {
      type: Object,
      default: function() {
        return {}
      }
    }
  },

  data() {
    return {
      showFiles: false
    }
  },

  computed: {
    ...mapGetters([
      'activeOrganization',
      'config',
      'userToken',
      'profile',
      'hasFeature',
      'getOrgMemberByIntId'
    ]),

    downloadManifestUrl: function() {
      if (this.config.api2Url && this.userToken) {
        return `${this.config.api2Url}/manifest/archive?manifest_id=${this.item.id}&api_key=Bearer ${this.userToken}`
      } else return null
    },
  },

  methods: {
    ...mapActions('uploadModule',[
      'fetchManifestDownloadUrl',
      'archiveManifest'
      ]
    ),

    toggleFiles: function() {
      this.showFiles = !this.showFiles
    },

    /**
     * Archive manifest method
     * @param permanent = false
     */
    onArchiveManifest: function(permanent = false) {

      if (this.item.status === 'Archived') {
        EventBus.$emit('toast', {
          detail: {
            type: 'error',
            msg: 'The selected manifest is already archived.'
          }
        })
      } else {
        let manifestId = this.item.id
        let result = this.archiveManifest({
          manifest_id:manifestId,
          permanent: permanent}
        ).then(result => {

          EventBus.$emit('toast', {
            detail: {
              type: 'success',
              msg: 'Archiving Manifest. The manifest is still accessible as a downloadable CSV file.'
            }
          })

          this.item.status = 'Archived'
        })
      }
    },

    downloadManifest: function() {
      let manifestId = this.item.id
      let result = this.archiveManifest({ manifest_id:manifestId, permanent: false}).then(value => {

          EventBus.$emit('toast', {
            detail: {
              type: 'success',
              msg: 'Getting the manifest ready, it will download shortly.'
            }
          })

        // Not ideal with wait, but will work.
        // TODO Refactor to improve workflow to wait until manifest CSV is available before attempting to download.
        setTimeout(() => {
          let result = this.fetchManifestDownloadUrl(this.item.id).then( result => {
            let presignedUrl = result.url
            const link = document.createElement('a');
            link.href = presignedUrl;
            link.setAttribute('download', name);
            document.body.appendChild(link);
            try {
              link.click();
            } catch (err) {
              console.error(err)
            }


            setTimeout(() => {
              document.body.removeChild(link);
              window.URL.revokeObjectURL(presignedUrl);
            }, 200);
          })
        }, 2500);

      })





    },



    /**
     * Handles dropdown menu selections
     * @param {String} memberId
     */
    handleCommand: function(command) {
      const commands = {
        'download': () => this.downloadManifest(),
        'archive': () => this.onArchiveManifest(true),
      }
      if (typeof commands[command] === 'function') {
        commands[command]()
      }
    },
  }
}
</script>


<style scoped lang="scss">
@import '../../../../assets/variables';

.member-col {
  color: $gray_5;

  &.menu {
    display: flex;
    justify-content: flex-end;
  }
}

.no-shrink {
  flex-shrink: 0;
}

.member {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0
}

.member-status {
  display: inline-block;
  text-transform: uppercase;
  border: solid 1px transparent;
  border-radius: 2px;
  font-size: 10px;
  line-height: 24px;
  height: 24px;
  width: 57px;
  text-align: center;
  margin-right: 16px;

  &.pending {
    color: #634B09;
    background-color: #FFC727;
  }
  &.expired {
    color: #404554;
    background-color: #BDBDBD;
  }
}

.svg-icon.menu {
  height: 8px;
  width: 24px;
}

.el-dropdown {
  margin-left: 16px;
}

.el-dropdown-link {
  cursor: pointer;
}

.toggle-files {
  cursor: pointer;
}


</style>
