<template>

  <div class="repoSelector">
    <el-dropdown
      class="drop-menu"
      trigger="click"
      placement="bottom-start"
      @command="onSelect"
    >
      <div class="button-wrapper">
        <div>
          <div class="mb-8">
            <h2 class="mb-0">Submit To:
              <img class="svg-icon"
                :src="fileIcon('Asterisk', 'Asterisk')"
              >
            </h2>

          </div>
          <div v-if="hasSelectedRepo" class="logo-wrapper">
            <img
              :src=logoPath
              class="logo"
              alt="Logo for Pennsieve"
            />
          </div>
          <div v-else >
            Select Repository...
          </div>
        </div>
        <div>
          <i class="el-icon-arrow-down el-icon&#45;&#45;right"></i>
        </div>
      </div>
      <template #dropdown>
        <el-dropdown-menu
          v-if="!locked"
          slot="dropdown"
          class="bf-menu"
          :offset="9"
        >
          <el-dropdown-item
            v-for="(repo, idx) in repositories"
            :key="repo.id"
            :command=idx
          >
            {{ repo.displayName }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>


</template>


<script  >
import {
  mapState,
  mapActions
} from 'vuex'
import { has } from 'ramda'
import FileIcon from '../../../mixins/file-icon/index';


export default {
  name: "RepoSelector",
  mixins: [
    FileIcon
  ],
  props: {
    locked: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    ...mapState('repositoryModule',[
      'repositories',
      'selectedRepoForRequest'
    ]),
    hasSelectedRepo: function() {
      if (this.selectedRepoForRequest) {
        return has("displayName", this.selectedRepoForRequest)
      }
      return false
    },
    logoPath: function() {
      if (this.selectedRepoForRequest) {
        return this.selectedRepoForRequest.logoFile
      }
      return ""
    },

    selectRepoStr: function() {
      if (this.selectedRepoForRequest.name) {
        return this.selectedRepoForRequest.name
      } else {
        return "Select Repository..."
      }

    }
  },
  methods:{
    ...mapActions('repositoryModule',[
      'setSelectedRepo'
    ]),
    onSelect: function(cmd) {

      this.setSelectedRepo(this.repositories[cmd] )
    }
  }
}


</script>

<style scoped lang="scss">
@import '../../../assets/_variables.scss';

.drop-menu {
  display:flex;
  width:100%;

}
.button-wrapper {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width:100%;
  padding:8px;
}

.logo-wrapper {
  justify-content: flex-end;
  .logo {
    height: 32px;
    width: auto;
  }
}

.repoSelector {
  border: 1px solid $gray_3;
  min-width: 300px;
  height: 64px;
  margin: 8px 0;
}

.dataset-filter-dropdown {
  display: flex;
  align-items: right;
}

.el-popper[x-placement^='bottom'] {
  margin-top: 5px;
  margin-left: -13px;
}

h2 {
  position: relative;
  display: inline-block;
  font-size: 14px;
  font-weight: 500;
}


.svg-icon {
  position: absolute;
  width: 8px;
  height: 8px;
  top: -0.25em; 
  right: -0.9em;
}

</style>