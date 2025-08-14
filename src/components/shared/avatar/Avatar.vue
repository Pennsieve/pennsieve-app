<template>
  <el-tooltip
    ref="tooltip"
    placement="top-start"
    :content="fullName"
    :disabled="!tooltip"
  >
    <div
      :class="`avatar-circle ${classOption}`"
      :style="`backgroundColor: ${profileColor}`"
    >
      <img
        :src="gravatarUrl"
        class="gravatar"
      >
      <span class="avatar-initials">
        {{ avatarText }}
      </span>
    </div>
  </el-tooltip>
</template>

<script>
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { compose, head, propOr, defaultTo } from 'ramda';
import md5 from 'blueimp-md5';

export default {
  name: 'Avatar',
  props: {
    classOption: {
      type: String,
      default: 'icon',
    },
    tooltip: {
      type: Boolean,
      default: false,
    },
    user: {
      default: null,
    },
  },
  setup(props) {
    const store = useStore();

    const profile = computed(() => store.getters.profile);
    
    const getOrgMemberByIntId = store.getters.getOrgMemberByIntId;

    const avatarProfile = computed(() => {
      if(!props.user){return profile.value}
      const userProfile = Number.isInteger(props.user)
        ? getOrgMemberByIntId(props.user)
        : props.user;
      return Object.keys(userProfile).length ? userProfile : profile.value;
    });


    const fullName = computed(() => {
      return `${avatarProfile.value.firstName || ''} ${avatarProfile.value.lastName || ''}`;
    });

    const getInitial = (propName, data) =>
      compose(head, defaultTo(''), propOr('', propName))(data);

    const firstInitial = computed(() => {
      return getInitial('firstName', avatarProfile.value);
    });

    const lastInitial = computed(() => {
      return getInitial('lastName', avatarProfile.value);
    });

    const emailHash = computed(() => {
      const email = propOr('', 'email', avatarProfile.value);
      return md5(email);
    });

    const gravatarUrl = computed(() => {
      return `//gravatar.com/avatar/${emailHash.value}?d=blank&r=g&s=48`;
    });

    const profileColor = computed(() => {
      return propOr('', 'color', avatarProfile.value);
    });

    const avatarText = computed(() => {
      const email = propOr('', 'email', avatarProfile.value);
      return firstInitial.value || lastInitial.value
        ? `${firstInitial.value}${lastInitial.value}`
        : email[0];
    });

    return {
      profile,
      avatarProfile,
      fullName,
      getInitial,
      gravatarUrl,
      profileColor,
      avatarText,
      firstInitial,
      lastInitial,
    };
  },
};
</script>

<style scoped lang="scss">
@import '../../../assets/_variables.scss';

.avatar-circle {
  position: relative;
  align-items: center;
  background: $app-primary-color;
  border-radius: 50%;
  box-sizing: border-box;
  color: $white;
  display: inline-flex;
  font-weight: 600;
  height: 32px;
  justify-content: center;
  overflow: hidden;
  width: 32px;

  border: 2px solid #fff;
  flex-shrink: 0;
}
.avatar-initials {
  font-weight: 500;
  line-height: 1;
  text-transform: uppercase;
}
.gravatar {
  position: absolute;
  z-index: 2;
  display: block;
  height: 100%;
  width: 100%;
}
</style>
