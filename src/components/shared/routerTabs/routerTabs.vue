<template >
  <ul class="tabs">
    <li v-for="tab in tabs" :key="tab.to">
      <router-link
        :to="{ name: tab.to }"
        :class="{ active: isTabActive(tab) }"
        active-class=""
      >
        {{ tab.name }}
      </router-link>
    </li>

  </ul>
</template>

<script>
export default {
  name: 'RouterTabs',
  props: {
    tabs: {
      type: Array,
      default: [
        {
          name: 'foo',
          to: 'much'
        }
      ]
    },
  },
  methods: {
    isTabActive(tab) {
      try {
        const currentName = this.$route.name
        if (currentName === tab.to) return true

        // Check if any matched route in the chain has this name
        const matched = this.$route.matched
        if (matched.some(r => r.name === tab.to)) return true

        // Check if current route path falls under the tab's resolved path
        const tabResolved = this.$router.resolve({ name: tab.to })
        if (tabResolved && this.$route.path.startsWith(tabResolved.path + '/')) return true

        return false
      } catch {
        return false
      }
    },
  },
}
</script>

<style scoped lang="scss">
@use '../../../styles/theme';

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tabs {
  display: flex;
  li {
    margin-left: 32px;
    &:first-child {
      margin: 0;
    }
  }
  a {
    color: theme.$gray_5;
    display: inline-flex;
    padding: 12px 0;
    position: relative;
    text-decoration: none;
    font-size: 14px;
    &:hover ,
    &:focus {
      color: theme.$purple_2;
      text-decoration: none;
    }
    &.active {
      color: theme.$purple_3;
      font-weight: 500;
      &:after {
        background: theme.$purple_3;
        bottom: -1px;
        content: '';
        left: 0;
        height: 2px;
        position: absolute;
        width: 100%;
        border-radius: 1px;
      }
    }
    &.disabled {
      cursor: default;
      color: theme.$gray_4;
    }
  }

  &.secondary {
    display: flex;
    li {
      margin-left: 32px;
      &:first-child {
        margin: 0;
      }
    }
    a {
      color: theme.$purple_tint;
      display: inline-flex;
      padding: 0 0 16px;
      position: relative;
      text-decoration: none;
      &:hover,
      &:focus {
        color: theme.$gray_2;
        text-decoration: none;
      }
      &.active {
        color: white;
        font-weight: 500;
        &:after {
          background: theme.$gray_1;
          bottom: 0;
          content: '';
          left: 0;
          height: 6px;
          position: absolute;
          width: 100%;
        }
      }
      &.disabled {
        cursor: default;
        color: theme.$purple_tint;
      }
    }
  }
}


</style>
