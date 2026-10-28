import { ref, computed } from 'vue'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import { useProposalStore } from '@/stores/proposalStore'
import { getProposalErrorMessage } from '@/utils/proposalErrorMessages'

/**
 * Saves (and optionally submits) a proposal coming out of the ProposalSurvey dialog.
 *
 * `saveProposal` resolves to true when the dialog should close. It only resolves
 * to false when nothing reached the server, so the user can retry from the
 * filled-in form without creating a duplicate proposal.
 */
export function useProposalSave() {
  const store = useStore()
  const proposalStore = useProposalStore()

  const isSavingProposal = ref(false)
  const profile = computed(() => store.state.profile)

  async function saveProposal(proposalData, { submit = false } = {}) {
    // Changing repository can't be done with PUT, so the dialog asks for the old
    // proposal to be replaced. This marker is for us, not the API.
    const { _originalProposal: replacedProposal, ...proposalFields } = proposalData

    isSavingProposal.value = true
    try {
      let savedProposal
      try {
        const response = proposalFields.nodeId
          ? await proposalStore.updateProposal(proposalFields, profile.value)
          : await proposalStore.storeNewProposal(proposalFields, profile.value)
        savedProposal = response.result
      } catch (error) {
        ElMessage.error(
          getProposalErrorMessage('save', error, {
            summary: submit ? 'Could not submit the proposal.' : undefined,
          })
        )
        return false
      }

      // From here the draft exists on the server, so the dialog closes even if
      // a later step fails: retrying from the form would create a duplicate.

      // Remove the old proposal only after its replacement exists, so a failure
      // never leaves the user with neither
      if (replacedProposal) {
        try {
          await proposalStore.removeProposal(replacedProposal)
        } catch (error) {
          ElMessage.warning(
            'Your proposal was moved, but the copy in the previous repository could not be removed. You can remove it from your list.'
          )
        }
      }

      if (!submit) {
        ElMessage.success('Proposal saved')
        return true
      }

      try {
        await proposalStore.submitProposal(savedProposal)
        ElMessage.success('Proposal submitted')
      } catch (error) {
        ElMessage.error(
          getProposalErrorMessage('submit', error, {
            summary: 'Your proposal was saved as a draft, but it could not be submitted.',
          })
        )
      }
      return true
    } finally {
      isSavingProposal.value = false
    }
  }

  return { isSavingProposal, saveProposal }
}
