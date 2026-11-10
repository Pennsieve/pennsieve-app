<script setup>
import { useTemplateRef } from "vue";
import ContentIntro from '@/components/shared/ContentIntro/ContentIntro.vue';
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
    description: "See each repository's scope and what it accepts.",
  },
  {
    icon: IconPlus,
    title: "Propose a dataset",
    description: "Drafts stay editable until you submit.",
  },
  {
    icon: IconEyeball,
    title: "Track status",
    description: "Follow each proposal through review.",
  },
];

function startNewProposal() {
  datasetProposals.value?.startNewProposal();
}
</script>

<template>
  <div class="data-publishing-page">
    <header class="page-header">
      <!-- As every page: what it's for on the left, the action on the right -->
      <ContentIntro text="Propose your datasets to open repositories on Pennsieve and follow them through review.">
        Accepted proposals become datasets in
        <router-link :to="{ name: 'shared-datasets' }" class="info-link">Shared With Me</router-link>;
        already in a repository's workspace? Create the dataset there and skip the review.
        <template #actions>
          <bf-button class="primary" @click="startNewProposal">+ New Proposal</bf-button>
        </template>
      </ContentIntro>

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
  // As the other pages' content: 20px under the header, 32px in
  padding: 20px 32px 32px;
  max-width: 1200px;
}

.page-header {
  margin-bottom: 32px;
}

/* The three steps: no boxes (a short list, not cards); three columns where
   they fit, else one under another, never two and one. */
.workflow-steps {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}

.workflow-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;

  .step-icon {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: theme.$purple_tint;
    color: theme.$purple_3;
  }

  .step-title {
    font-size: 15px;
    font-weight: 600;
    color: theme.$gray_6;
    margin: 4px 0 4px 0;
  }

  .step-description {
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;
    margin: 0;
  }
}

@container (min-width: 760px) {
  .workflow-steps {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 32px;
  }
}


/* In the intro's sentence: no gap before it (the intro spaces a link that
   ends it). */
.page-header .info-link {
  margin-left: 0;
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


</style>
