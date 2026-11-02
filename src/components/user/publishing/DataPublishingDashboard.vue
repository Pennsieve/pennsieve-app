<script setup>
import { useTemplateRef } from "vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import DatasetProposals from "./DatasetProposals.vue";
import RepositoryPanel from "./RepositoryPanel.vue";
import IconPlus from "@/components/icons/IconPlus.vue";
import IconCompass from "@/components/icons/IconCompass.vue";
import IconEyeball from "@/components/icons/IconEyeball.vue";

// The proposals column owns the proposal dialog, so the page-level button
// delegates to it rather than duplicating that state here
const datasetProposals = useTemplateRef("datasetProposals");

// Static content; icons are components so they're kept out of reactivity
const workflowSteps = [
  {
    icon: IconCompass,
    title: "Explore repositories",
    description: "Click a repository under Open Repositories to see its scope and what it accepts.",
  },
  {
    icon: IconPlus,
    title: "Propose a dataset",
    description: "Click New Proposal to begin. Drafts remain editable until submitted.",
  },
  {
    icon: IconEyeball,
    title: "Track status",
    description: "Follow each proposal from submission through acceptance.",
  },
];

function startNewProposal() {
  datasetProposals.value?.startNewProposal();
}
</script>

<template>
  <div class="data-publishing-page">
    <header class="page-header">
      <div class="header-row">
        <p class="page-intro">
          Propose your datasets to open repositories on Pennsieve and follow them through review.
        </p>
        <bf-button class="primary" @click="startNewProposal">
          <template #prefix>
            <IconPlus :width="14" :height="14" color="currentColor" />
          </template>
          New Proposal
        </bf-button>
      </div>

      <ul class="workflow-steps">
        <li v-for="step in workflowSteps" :key="step.title" class="workflow-step">
          <span class="step-icon">
            <component :is="step.icon" :width="20" :height="20" color="currentColor" />
          </span>
          <div class="step-text">
            <h3 class="step-title">{{ step.title }}</h3>
            <p class="step-description">{{ step.description }}</p>
          </div>
        </li>
      </ul>

      <p class="info-note">
        Accepted proposals become datasets you can find in
        <router-link :to="{ name: 'shared-datasets' }" class="info-link">Shared With Me</router-link> Page.
        If you already collaborate in a repository's workspace, create your dataset there directly to
        skip the proposal review.
      </p>
    </header>

    <div class="publishing-layout">
      <dataset-proposals ref="datasetProposals" class="proposals-column" />
      <repository-panel class="repositories-column" />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/theme";

.data-publishing-page {
  // Query the page's own width: the side nav changes the space available,
  // so viewport breakpoints would misjudge it
  container-type: inline-size;
  padding: 32px;
  max-width: 1200px;
}

.page-header {
  margin-bottom: 40px;

  .header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 24px;
  }

  .page-intro {
    font-size: 18px;
    color: theme.$gray_6;
    line-height: 1.5;
    margin: 0;
  }
}

.workflow-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  list-style: none;
  margin: 0 0 16px 0;
  padding: 0;
}

.workflow-step {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 8px;

  .step-icon {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: theme.$purple_tint;
    color: theme.$purple_3;
  }

  .step-title {
    font-size: 15px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 4px 0;
  }

  .step-description {
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;
    margin: 0;
  }
}

.info-note {
  background: theme.$gray_1;
  border-left: 3px solid theme.$yellow_1;
  padding: 12px 16px;
  font-size: 13px;
  color: theme.$gray_5;
  line-height: 1.5;
  margin: 0;
}

.info-link {
  color: theme.$purple_2;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
}

.publishing-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  // Repositories sit above the list on narrow screens so they stay discoverable
  grid-template-areas:
    "repositories"
    "proposals";
  gap: 32px;
}

.proposals-column {
  grid-area: proposals;
}

.repositories-column {
  grid-area: repositories;
}

@container (min-width: 960px) {
  .publishing-layout {
    grid-template-columns: minmax(0, 1fr) 300px;
    grid-template-areas: "proposals repositories";
    align-items: start;
  }

  .repositories-column {
    position: sticky;
    top: 24px;
  }
}

@container (max-width: 640px) {
  .page-header .header-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
