<template>
  <div class="request-list-item is-clickable" @click="handleItemClick">
    <div class="request-content">
      <!-- Main content -->
      <div class="request-main">
        <!-- Header with title and status -->
        <div class="request-header">
          <h3 class="request-title">
            {{ datasetRequest.name || "Untitled Proposal" }}
          </h3>
          <div class="status-badges">
            <span class="status-badge" :class="statusBadgeClass">
              {{ statusDisplay }}
            </span>
            <span v-if="!readyToSubmit && isDraft" class="status-badge status-incomplete">
              Incomplete
            </span>
          </div>
        </div>

        <!-- Repository and description -->
        <div class="request-body">
          <div class="repository-info">
            <img
              v-if="logoPath"
              :src="logoPath"
              :alt="`${repositoryName} logo`"
              class="repository-logo"
            />
            <span class="repository-name">{{ repositoryName }}</span>
          </div>

          <p class="request-description" v-if="datasetRequest.description">
            {{ truncatedDescription }}
          </p>
        </div>

        <!-- Footer with metadata and actions -->
        <div class="request-footer">
          <div class="request-metadata">
            <span v-if="displayDate">
              {{ displayDate }}
            </span>
          </div>

          <!-- Action buttons -->
          <div class="action-buttons">
            <!-- Draft actions -->
            <template v-if="isDraft">
              <button
                v-if="readyToSubmit"
                type="button"
                class="action-button primary"
                @click.stop="triggerRequest(DatasetProposalAction.SUBMIT)"
              >
                Submit
              </button>
              <button
                v-else
                type="button"
                class="action-button secondary"
                @click.stop="triggerRequest(DatasetProposalAction.EDIT)"
              >
                Edit
              </button>
              <button
                type="button"
                class="action-button danger"
                @click.stop="triggerRequest(DatasetProposalAction.REMOVE)"
              >
                Remove
              </button>
            </template>

            <!-- Submitted actions -->
            <template v-else-if="isSubmitted">
              <button
                type="button"
                class="action-button danger"
                @click.stop="triggerRequest(DatasetProposalAction.WITHDRAW)"
              >
                Withdraw
              </button>
            </template>

            <!-- Accepted actions -->
            <template v-else-if="isAccepted">
              <button
                type="button"
                class="action-button primary"
                @click.stop="triggerRequest(DatasetProposalAction.OPEN_DATASET)"
              >
                <span>Open Dataset</span>
                <span class="arrow">&rarr;</span>
              </button>
            </template>

            <template v-else-if="isRejected || isWithdrawn">
              <button
                type="button"
                class="action-button primary"
                @click.stop="triggerRequest(DatasetProposalAction.COPY_TO_DRAFT)"
              >
                Copy to new draft
              </button>
              <button
                type="button"
                class="action-button danger"
                @click.stop="triggerRequest(DatasetProposalAction.REMOVE)"
              >
                Remove
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useProposalStore } from "@/stores/proposalStore";
import { DatasetProposalAction } from "@/utils/constants";
import { isValidProposalName, hasText } from "@/utils/proposalValidation";

// Props
const props = defineProps({
  datasetRequest: {
    type: Object,
    default: () => ({}),
  },
});

// Emits
const emit = defineEmits([
  "edit",
  "remove",
  "submit",
  "withdraw",
  "open-dataset",
  "copy-to-draft",
]);

// Store
const proposalStore = useProposalStore();

// Computed properties
const repository = computed(() => {
  if (props.datasetRequest?.organizationNodeId) {
    return proposalStore.getRepositoryByNodeId(
      props.datasetRequest.organizationNodeId
    );
  }
  return null;
});

const repositoryName = computed(() => {
  return repository.value?.displayName || "Unknown Repository";
});

const logoPath = computed(() => {
  return repository.value?.logoFile || "";
});

const statusDisplay = computed(() => {
  const statusMap = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    ACCEPTED: "Accepted",
    REJECTED: "Rejected",
    WITHDRAWN: "Withdrawn",
  };
  return (
    statusMap[props.datasetRequest.proposalStatus] ||
    props.datasetRequest.proposalStatus
  );
});

const statusBadgeClass = computed(() => {
  const status = props.datasetRequest.proposalStatus?.toLowerCase();
  return `status-${status}`;
});

const isDraft = computed(() => {
  return props.datasetRequest.proposalStatus === "DRAFT";
});

const isSubmitted = computed(() => {
  return props.datasetRequest.proposalStatus === "SUBMITTED";
});

const isAccepted = computed(() => {
  return props.datasetRequest.proposalStatus === "ACCEPTED";
});

const isRejected = computed(() => {
  return props.datasetRequest.proposalStatus === "REJECTED";
});

const isWithdrawn = computed(() => {
  return props.datasetRequest.proposalStatus === "WITHDRAWN";
});

const isEditable = computed(() => {
  return isDraft.value || isWithdrawn.value;
});

const truncatedDescription = computed(() => {
  const desc = props.datasetRequest.description || "";
  return desc.length > 150 ? desc.substring(0, 150) + "..." : desc;
});

const surveyComplete = computed(() => {
  const questions = repository.value?.questions;
  const surveyResponses = props.datasetRequest.survey;
  if (questions == null || surveyResponses == null) {
    return false;
  }

  return questions.every((question) => {
    const answer = surveyResponses.find(
      (response) => response.questionId === question.id
    );
    return hasText(answer?.response);
  });
});

const readyToSubmit = computed(() => {
  return (
    isValidProposalName(props.datasetRequest.name) &&
    hasText(props.datasetRequest.description) &&
    surveyComplete.value
  );
});

// Methods
const handleItemClick = () => {
  // Always trigger view/edit action - parent will decide if it's read-only or editable
  triggerRequest(DatasetProposalAction.EDIT);
};

const triggerRequest = (action) => {
  emit(action, props.datasetRequest);
};

const formatDate = (timestamp) => {
  if (!timestamp || timestamp === 0) return "";

  // Handle both Unix timestamps (seconds) and JavaScript timestamps (milliseconds)
  const date =
    timestamp > 1000000000000
      ? new Date(timestamp)
      : new Date(timestamp * 1000);
  const options = { year: "numeric", month: "short", day: "numeric" };
  return date.toLocaleDateString("en-US", options);
};

// Computed properties for date displays
const displayDate = computed(() => {
  const request = props.datasetRequest;

  // Show submitted date if proposal was submitted
  if (isSubmitted.value && request.submittedAt && request.submittedAt !== 0) {
    return `Submitted ${formatDate(request.submittedAt)}`;
  }

  // Show accepted date if proposal was accepted
  if (isAccepted.value && request.acceptedAt && request.acceptedAt !== 0) {
    return `Accepted ${formatDate(request.acceptedAt)}`;
  }

  // Show rejected date if proposal was rejected
  if (isRejected.value && request.rejectedAt && request.rejectedAt !== 0) {
    return `Rejected ${formatDate(request.rejectedAt)}`;
  }

  // Show withdrawn date if proposal was withdrawn
  if (isWithdrawn.value && request.withdrawnAt && request.withdrawnAt !== 0) {
    return `Withdrawn ${formatDate(request.withdrawnAt)}`;
  }

  // For drafts and other statuses, show updated date or created date
  if (
    request.updatedAt &&
    request.updatedAt !== 0 &&
    request.updatedAt !== request.createdAt
  ) {
    return `Updated ${formatDate(request.updatedAt)}`;
  }

  if (request.createdAt && request.createdAt !== 0) {
    return `Created ${formatDate(request.createdAt)}`;
  }

  return "";
});
</script>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.request-list-item {
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background-color: white;
  transition: all 0.2s ease;

  &:hover {
    background-color: theme.$gray_1;
  }

  &.is-clickable {
    cursor: pointer;
  }
}

.request-content {
  padding: 24px 24px 12px;
}

.request-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.request-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  @media (max-width: 640px) {
    flex-direction: column;
    gap: 8px;
  }
}

.request-title {
  font-size: 16px;
  font-weight: 600;
  color: theme.$gray_6;
  margin: 0;
  line-height: 1.4;
  flex: 1;
}

.status-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

// Matches the status badges in Analysis > Applications
.status-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: theme.$gray_2;
  color: theme.$gray_5;

  &.status-submitted {
    background: theme.$purple_tint;
    color: theme.$purple_3;
  }

  &.status-accepted {
    background: rgba(theme.$green_1, 0.12);
    color: theme.$green_1;
  }

  &.status-rejected {
    background: rgba(theme.$red_1, 0.1);
    color: theme.$red_1;
  }

  &.status-withdrawn {
    background: rgba(theme.$orange_1, 0.1);
    color: theme.$orange_1;
  }

  &.status-incomplete {
    background: rgba(theme.$purple_1, 0.1);
    color: theme.$purple_1;
  }
}

.request-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.repository-info {
  display: flex;
  align-items: center;
  gap: 8px;

  .repository-logo {
    height: 20px;
    width: auto;
    max-width: 80px;
    object-fit: contain;
  }

  .repository-name {
    font-size: 13px;
    color: theme.$gray_4;
    font-weight: 500;
  }
}

.request-description {
  font-size: 13px;
  color: theme.$gray_5;
  line-height: 1.5;
  margin: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.request-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid theme.$gray_3;

  @media (max-width: 640px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
}

.request-metadata {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: theme.$gray_5;
}

.action-buttons {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;

  @media (max-width: 640px) {
    width: 100%;
    align-items: flex-end;
  }
}

.action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:focus-visible {
    outline: 2px solid theme.$purple_2;
    outline-offset: 2px;
  }

  &:active {
    transform: translateY(1px);
  }

  &.primary {
    background: theme.$purple_3;
    color: theme.$white;

    &:hover {
      background: theme.$purple_2;
    }
  }

  // White fill keeps it distinct from the card's gray hover background
  &.secondary {
    background: theme.$white;
    border-color: theme.$gray_3;
    color: theme.$gray_6;

    &:hover {
      background: theme.$gray_0;
      border-color: theme.$gray_4;
    }
  }

  &.danger {
    background: theme.$white;
    border-color: rgba(theme.$red_2, 0.4);
    color: theme.$red_2;

    &:hover {
      background: rgba(theme.$red_2, 0.08);
      border-color: theme.$red_2;
    }
  }

  .arrow {
    transition: transform 0.15s ease;
  }

  &:hover .arrow {
    transform: translateX(2px);
  }
}
</style>
