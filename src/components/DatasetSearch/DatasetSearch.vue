<template>
  <div class="dataset-search">
    <form @submit.prevent="setSearch">
      <el-input
        ref="input"
        v-model="search.q"
        class="dataset-search-input mr-16"
        placeholder="Find Public Datasets..."
        @input.native="onInput">
<!--        :prefix-icon=IconMagnifyingGlass-->
      >
        <template #prefix>
          <IconMagnifyingGlass
              :height="24"
              :width="24"
              color="#71747c"
          />
        </template>


      </el-input>

      <bf-button :class="submitButtonType" type="submit">
        Search
      </bf-button>
    </form>
  </div>
</template>

<script>
import {clone, propOr} from 'ramda'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import {mapGetters} from "vuex";
import IconMagnifyingGlass from '../icons/IconMagnifyingGlass.vue'

export default {
  name: 'DatasetSearch',

  components: {
    BfButton,
    IconMagnifyingGlass
  },

  props: {
    submitButtonType: {
      type: String,
      default: ''
    }
  },

  computed: {
    ...mapGetters([
      'config'
    ]),
  },

  data() {
    return {
      q: '',
      search: {
        q: ''
      }
    }
  },

  created() {
    this.search = clone(this.$route.query)
  },

  methods: {
    /**
     * Emit search event
     */
    setSearch() {
      const query = Object.assign({}, this.search)
      this.$refs.input.blur()

      const discoverUrl = propOr('', 'discoverAppUrl', this.config)

      window.location.href = `${discoverUrl}/search?q=${query.q}`;
    },

    /**
     * Focus on the input
     */
    focus() {
      this.$refs.input.focus()
    },

    /**
     * Capture input to a single data prop
     * Fix for an Android GBoard quirk
     */
    onInput(evt) {
      this.q = evt.target.value
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../../assets/_variables.scss';

.dataset-search {
  display: flex;
  form {
    display: flex;
    flex: 1;
  }
}

.dataset-search-input,
.dataset-search-input ::placeholder {
  color: $purple_2;
}

</style>
