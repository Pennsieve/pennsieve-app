<template>
  <div class="organization-label">
    <circle-icon
      class="mr-8"
    >
      <template #icon>
        <IconOrganization/>
      </template>
    </circle-icon>
    <div class="organization-label-details">
      <div class="name">
        <span class="display-name">
          Everyone at {{ name }}
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import CircleIcon from '../../shared/CircleIcon/CircleIcon.vue'

import { pathOr } from 'ramda'
import IconOrganization from "../../icons/IconOrganization.vue";

export default {
  name: 'OrganizationLabel',

  components: {
    IconOrganization,
    CircleIcon
  },

  props: {
    item: {
      type: Object,
      default: function() {
        return {
          administrators: [],
          isAdmin: false,
          isOwner: false,
          organization: {},
          owners: []
        }
      }
    }
  },

  computed: {
    name: function() {
      return pathOr('', ['organization', 'name'], this.item)
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/theme';

.organization-label {
  display: flex;
  align-items: center;
}

.organization-label-details {
  .name {
    color: #000;
    font-weight: 600;
    font-size: 16px;

    .display-name {
      font-size: 14px;
    }
  }
}
</style>
