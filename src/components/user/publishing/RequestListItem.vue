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
            <span class="request-status" :class="statusClass">
              {{ statusDisplay }}
            </span>
            <span v-if="!readyToSubmit && isDraft" class="incomplete-badge">
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
                class="text-link primary-action"
                @click.stop="triggerRequest(DatasetProposalAction.SUBMIT)"
              >
                Submit
              </button>
              <button
                v-else
                class="text-link"
                @click.stop="triggerRequest(DatasetProposalAction.EDIT)"
              >
                Edit
              </button>
              <button
                class="text-link secondary-action"
                @click.stop="triggerRequest(DatasetProposalAction.REMOVE)"
              >
                Remove
              </button>
            </template>

            <!-- Submitted actions -->
            <template v-else-if="isSubmitted">
              <button
                class="text-link secondary-action"
                @click.stop="triggerRequest(DatasetProposalAction.WITHDRAW)"
              >
                Withdraw
              </button>
            </template>

            <!-- Accepted actions -->
            <template v-else-if="isAccepted">
              <button
                class="text-link primary-action"
                @click.stop="triggerRequest(DatasetProposalAction.OPEN_DATASET)"
              >
                Open Dataset
              </button>
            </template>

            <!-- Rejected actions -->
            <template v-else-if="isRejected">
              <button
                class="text-link"
                @click.stop="triggerRequest(DatasetProposalAction.RESUBMIT)"
              >
                Resubmit
              </button>
            </template>

            <!-- Withdrawn actions -->
            <!-- <template v-else-if="isWithdrawn">
              <button 
                class="text-link"
                @click.stop="triggerRequest(DatasetProposalAction.EDIT)"
              >
                Edit & Resubmit
              </button>
            </template> -->
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
  "resubmit",
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

const statusClass = computed(() => {
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
  let result = false;
  const organizationNodeId = props.datasetRequest.organizationNodeId;
  const repo = repository.value;

  if (
    repo &&
    repo.questions != null &&
    props.datasetRequest &&
    props.datasetRequest.survey != null
  ) {
    result = repo.questions
      .map((q) => {
        const answer = props.datasetRequest.survey.find(
          (r) => r.questionId === q.id
        );
        return answer && answer.response !== "";
      })
      .reduce((a, c) => a && c, true);
  }
  return result;
});

const readyToSubmit = computed(() => {
  const validName =
    props.datasetRequest.name !== null && props.datasetRequest.name !== "";
  const validDescription =
    props.datasetRequest.description !== null &&
    props.datasetRequest.description !== "";
  return validName && validDescription && surveyComplete.value;
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
  border-bottom: 1px solid theme.$gray_2;
  background-color: white;
  transition: all 0.2s ease;

  &:first-child {
    border-top: none;
  }

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: theme.$gray_1;
  }

  &.is-clickable {
    cursor: pointer;
  }
}

.request-content {
  padding: 16px;
}

.request-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.request-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

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
  gap: 6px;
  flex-wrap: wrap;
}

.request-status {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  text-transform: capitalize;
  white-space: nowrap;

  &.status-draft {
    background: theme.$gray_1;
    color: theme.$gray_5;
  }

  &.status-submitted {
    background: rgba(theme.$green_2, 0.1);
    color: theme.$green_2;
  }

  &.status-accepted {
    background: rgba(theme.$green_1, 0.1);
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
}

.incomplete-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  background: rgba(theme.$purple_1, 0.1);
  color: theme.$purple_1;
  text-transform: uppercase;
  letter-spacing: 0.5px;
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
  padding-top: 8px;
  border-top: 1px solid theme.$gray_1;

  @media (max-width: 640px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}

.request-metadata {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: theme.$gray_4;

  .warning-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    color: theme.$orange_1;
    font-weight: 500;
  }
}

.action-buttons {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 4px;

  @media (max-width: 640px) {
    width: 100%;
    align-items: flex-end;
  }
}

.text-link {
  background: none;
  border: none;
  color: theme.$purple_2;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 3px 6px;
  transition: all 0.15s ease;
  white-space: nowrap;
  border-radius: 4px;
  text-decoration: none;

  &:hover {
    color: theme.$purple_3;
    background: rgba(theme.$purple_2, 0.05);
  }

  &.primary-action {
    color: theme.$purple_2;
    font-weight: 600;

    &:hover {
      color: darken(theme.$purple_2, 10%);
      background: rgba(theme.$purple_2, 0.08);
    }
  }

  &.secondary-action {
    color: theme.$red_2;

    &:hover {
      color: darken(theme.$red_2, 10%);
      background: rgba(theme.$red_2, 0.05);
    }
  }
}

// Button overrides for compact size
:deep(.bf-button) {
  &.compact {
    padding: 5px 12px;
    font-size: 13px;
    min-width: auto;
    font-weight: 500;
  }
}
</style>
