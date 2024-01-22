<template >
  <ul
    class="tabs"
  >
    <li v-for="tab in tabs" :key="tab.to">
      <router-link :to="{ name: tab.to }">
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

}
</script>

<style scoped lang="scss">
@import '../../../assets/_variables.scss';

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tabs {
  a {
    color: $gray_5;
    display: inline-flex;
    padding: 0 0 16px;
    position: relative;
    text-decoration: none;
    &:hover,
    &:focus {
      color: $purple_2;
      text-decoration: none;
    }
    &.router-link-active,
    &.active {
      color: $purple_2;
      &:after {
        background: $purple_1;
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
      color: $gray_4;
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
      color: $purple_tint;
      display: inline-flex;
      padding: 0 0 16px;
      position: relative;
      text-decoration: none;
      &:hover,
      &:focus {
        color: $gray_2;
        text-decoration: none;
      }
      &.router-link-active,
      &.active {
        color: white;
        &:after {
          background: $gray_1;
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
        color: $purple_tint;
      }
    }
  }
}
</style>
