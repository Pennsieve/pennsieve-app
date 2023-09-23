<template>
    <bf-stage
      slot="stage"
      v-loading="isLoading"
      element-loading-background="transparent"
    >

      <template #actions>
        <a href="https://docs.pennsieve.io" target="_blank" class="mr-16"><bf-button>Visit Documentation Hub</bf-button></a>
        <bf-button
          @click="navigateToSubmit"
        >
          Submit a Dataset
        </bf-button>
      </template>

      <h1>Repositories</h1>
      <p> Pennsieve is a cloud-based data management and publication platform which supports several public repositories as well as private consortium workspaces.</p>

      <div
        v-if="repositories.length > 0"
        class="integration-list"
      >
        <repository-list-item
          v-for="repo in repositories"
          :key="repo.id"
          :repository="repo"
        />
      </div>

      <repository-info
        :dialog-visible="repositoryModalVisible"
        :repository="selectedRepoForRequest"
      />
    </bf-stage>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex'

import BfRafter from '../shared/bf-rafter/BfRafter.vue'
import BfButton from '../shared/bf-button/BfButton.vue'
import RepositoryInfo from './repository-info/RepositoryInfo.vue'

import PaginationPageMenu from '../shared/PaginationPageMenu/PaginationPageMenu.vue'
import RepositoryListItem from './repository-list-item/repositoryListItem.vue'
import PennsieveLogoContainer from "../shared/PennsieveLogoContainer/PennsieveLogoContainer.vue";

export default {
  name: 'Welcome',

  components: {
    PennsieveLogoContainer,
    BfRafter,
    BfButton,
    PaginationPageMenu,
    RepositoryListItem,
    RepositoryInfo
  },

  mixins: [
  ],

  props: {
    repositories: {
      type: Array,
      default: () => []
    }
  },

  data() {
    return {
      isLoading: false,
    }
  },

  computed: {
    ...mapState('repositoryModule', [
      'repositoryModalVisible',
      'selectedRepoForRequest'
    ]),
    ...mapGetters([
      'activeOrganization'
    ]),
  },


  watch: {
  },

  methods: {
    navigateToSubmit: function() {
      this.$router.push({
        name: 'submit',
        params: {  }
      })
    }
  },
}
</script>

<style scoped lang="scss">

h1 {
  font-size: 22px;
  margin-bottom: 8px;
}

p {
  max-width: 760px;
}

.buttons {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  max-width: 380px;
  margin: 48px 0px;
}
.logo {
  width: 300px;
}

.content {
  margin-top: 40px
}

.data-usage {
  text-align: right;
}
.col-spacer {
  height: 17px;
}
.pagination-header {
  display: flex;
  justify-content: space-between
}

.logo-container {
  width: 500px;
}
</style>