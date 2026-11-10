<script setup>
import { ref, computed } from "vue";
import { useProposalStore } from "@/stores/proposalStore";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import RepositoryInfoModal from "./RepositoryInfoModal.vue";
import IconArrowRight from "@/components/icons/IconArrowRight.vue";

const proposalStore = useProposalStore();

const isRepositoryDialogVisible = ref(false);
const activeRepository = ref({});
const repositoryIdsWithBrokenLogo = ref(new Set());

const isLoading = computed(() => proposalStore.isLoadingRepositories);
const loadError = computed(() => proposalStore.repositoriesError);

const repositories = computed(() => proposalStore.repositories);

function getInitials(displayName = "") {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function hasLogo(repository) {
  return Boolean(repository.logoFile) && !repositoryIdsWithBrokenLogo.value.has(repository.id);
}

function markLogoBroken(repository) {
  repositoryIdsWithBrokenLogo.value.add(repository.id);
}

function openRepository(repository) {
  activeRepository.value = repository;
  isRepositoryDialogVisible.value = true;
}
</script>

<template>
  <aside class="repository-panel" aria-labelledby="repository-panel-title">
    <h2 id="repository-panel-title" class="panel-title">Open Repositories</h2>
    <p class="panel-subtitle">Select a repository to learn what it accepts.</p>

    <el-skeleton v-if="isLoading && !repositories.length" :rows="4" animated />

    <div v-else-if="loadError" class="panel-message">
      <p>{{ loadError }}</p>
      <bf-button class="secondary" @click="proposalStore.fetchRepositories()">
        Try Again
      </bf-button>
    </div>

    <p v-else-if="!repositories.length" class="panel-message">
      No repositories available at this time.
    </p>

    <ul v-else class="repository-list">
      <li v-for="repository in repositories" :key="repository.id">
        <button type="button" class="repository-row" @click="openRepository(repository)">
          <span class="repository-logo">
            <img
              v-if="hasLogo(repository)"
              :src="repository.logoFile"
              alt=""
              loading="lazy"
              @error="markLogoBroken(repository)"
            />
            <span v-else class="logo-initials" aria-hidden="true">
              {{ getInitials(repository.displayName) }}
            </span>
          </span>

          <span class="repository-text">
            <span class="repository-name">{{ repository.displayName }}</span>
          </span>

          <IconArrowRight class="row-chevron" :width="16" :height="16" color="currentColor" />
        </button>
      </li>
    </ul>

    <repository-info-modal
      v-model:dialog-visible="isRepositoryDialogVisible"
      :repository="activeRepository"
    />
  </aside>
</template>

<style scoped lang="scss">
@use "@/styles/theme";

.repository-panel {
  // Lets the list switch to a horizontal strip when the panel spans the page
  container: repository-panel / inline-size;
  min-width: 0;
}

.panel-title {
  font-size: 16px;
  font-weight: 500;
  color: theme.$gray_6;
  margin: 0 0 4px 0;
}

.panel-subtitle {
  font-size: 13px;
  color: theme.$gray_5;
  margin: 0 0 16px 0;
}

.panel-message {
  font-size: 14px;
  color: theme.$gray_5;

  p {
    margin: 0 0 8px 0;
  }
}

.repository-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid theme.$gray_2;
  background: theme.$white;
  overflow: hidden;

  li + li {
    border-top: 1px solid theme.$gray_2;
  }
}

.repository-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  background: transparent;
  font-family: theme.$system-font;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: theme.$gray_1;

    .row-chevron {
      color: theme.$purple_3;
    }
  }

  &:focus-visible {
    outline: 2px solid theme.$purple_2;
    outline-offset: -2px;
  }
}

.repository-logo {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid theme.$gray_2;
  background: theme.$white;
  overflow: hidden;

  img {
    max-width: 32px;
    max-height: 32px;
    object-fit: contain;
  }

  .logo-initials {
    font-size: 14px;
    font-weight: 600;
    color: theme.$purple_3;
  }
}

.repository-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.repository-name {
  font-size: 14px;
  font-weight: 500;
  color: theme.$gray_6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-chevron {
  flex-shrink: 0;
  color: theme.$gray_4;
  transition: color 0.15s ease;
}

// Panel spans the full page width on narrow layouts: show a scrollable strip
// so it doesn't push the proposals far down
@container repository-panel (min-width: 480px) {
  .repository-list {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    border: none;
    background: transparent;
    padding-bottom: 4px;

    li {
      flex: 0 0 240px;
      scroll-snap-align: start;
    }

    li + li {
      border-top: none;
    }
  }

  .repository-row {
    border: 1px solid theme.$gray_2;
    background: theme.$white;
  }
}
</style>
