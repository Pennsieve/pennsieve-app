<script setup>
import { ref, computed, onMounted } from "vue";
import { useStore } from 'vuex';
import BfEmptyPageState from "../shared/bf-empty-page-state/BfEmptyPageState.vue";
import RepoListItem from "./RepoListItem.vue";
import ChangeRepoTrackingDialog from "@/components/Code/ChangeRepoTrackingDialog.vue";
import PublishCodeRepoDialog from "@/components/Code/PublishCodeRepoDialog.vue";
import { find, propEq } from "ramda";

const store = useStore();



const isLoadingRepos = ref(false)

const myReposCount = computed(() => {return store.getters["codeReposModule/myReposCount"]})
const myReposPaginationParams = computed(() => {return store.getters["codeReposModule/myReposPaginationParams"]})
const myReposLoaded = computed(() => {return store.getters["codeReposModule/myReposLoaded"]})
const myRepos = computed(() => {return store.getters["codeReposModule/myRepos"]})

const showEmptyState = computed(() => {
  return myReposLoaded.value && !myRepos.value.length;
})

onMounted(async () => {
  try {
    isLoadingRepos.value = true;
    await store.dispatch("codeReposModule/fetchMyRepos",{
      page: myReposPaginationParams.value.page,
      size: myReposPaginationParams.value.size,
    })

  } catch (err) {
    console.error(err);
  } finally {
    isLoadingRepos.value = false;
  }
})

async function onPaginationPageChange(page) {
  try {
    isLoadingRepos.value = true;
    await store.dispatch("codeReposModule/fetchMyRepos",{
      page,
      size: this.myReposPaginationParams.size,
    });

    isLoadingRepos.value = false;
  } catch (err) {
    console.error(err);
  }
}

const showTrackDialog = ref(false)
const selectedRepo = ref({})
function openTrackDialog(repoName) {
  selectedRepo.value = find(propEq('name', repoName), myRepos.value)
  showTrackDialog.value = true
}
function onChangeRepoTrackingDialogClose() {
  showTrackDialog.value = false

}

</script>

<template>
  <bf-stage v-loading="isLoadingRepos" element-loading-text="Loading...">
    <bf-empty-page-state class="empty" v-if="showEmptyState">
      <p>
        You have not linked your Github account to Pennsieve yet. Please link
        your account to see your available repos.
      </p>
    </bf-empty-page-state>
<!--    <div class="pagination-container">-->
<!--      <el-pagination-->
<!--        v-if="myReposCount"-->
<!--        :page-size="myReposPaginationParams.size"-->
<!--        :current-page="myReposPaginationParams.currentPage"-->
<!--        layout="prev, pager, next"-->
<!--        :total="myReposCount"-->
<!--        @current-change="onPaginationPageChange"-->
<!--      />-->
<!--    </div>-->
    <div>
      <RepoListItem
        my-repos-view
        v-for="repo in myRepos"
        :isTracked="repo?.tracking"
        :key="repo.name"
        :repo="repo"
        @open-track-dialog="openTrackDialog"
      ></RepoListItem>
    </div>
<!--    <div class="pagination-container">-->
<!--      <el-pagination-->
<!--        v-if="myReposCount && myRepos.length > 5"-->
<!--        :page-size="myReposPaginationParams.size"-->
<!--        :current-page="myReposPaginationParams.currentPage"-->
<!--        layout="prev, pager, next"-->
<!--        :total="myReposCount"-->
<!--        @current-change="onPaginationPageChange"-->
<!--      />-->
<!--    </div>-->

        <change-repo-tracking-dialog
          :dialog-visible="showTrackDialog"
          :start-tracking-mode="!selectedRepo.tracking"
          :stop-tracking-mode="selectedRepo.tracking"
          :repo="selectedRepo"
          @close="onChangeRepoTrackingDialogClose"
        />
<!--        <publish-code-repo-dialog-->
<!--          :dialog-visible="isPublishCodeRepoDialogVisible"-->
<!--          :repo="repo"-->
<!--          @close="onPublishCodeRepoDialogVisibleClose"-->
<!--        />-->

  </bf-stage>
</template>

<style scoped lang="scss">
@import "../../assets/_variables.scss";

.pagination-container {
  display: flex;
  justify-content: flex-end;
}

.empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}
</style>
