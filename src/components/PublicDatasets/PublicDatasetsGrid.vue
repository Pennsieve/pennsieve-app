<template>
  <div class="dataset-list">
      <public-dataset
        v-for="dataset in visibleCards"
        :key="dataset.id"
        class="mb-8"
        :dataset="dataset"
      />
  </div>
</template>

<script>
import PublicDataset from './PublicDataset.vue'
import {mapGetters} from "vuex";
import Request from '../../mixins/request/index'

export default {
  name: 'PublicDatasetsGrid',

  components: {
    PublicDataset
  },

  // props: {
  //   datasets: {
  //     type: Array,
  //     default: () => []
  //   }
  // },

  computed: {
    ...mapGetters([
      'config'
    ]),
    visibleCards: function(){
      let cardWidth = 352; // 350  wide + 1px border
      let nrRows = 3
      let nrCards = nrRows * Math.floor((this.windowWidth - 16) /cardWidth)
      return this.datasets.slice(0, nrCards)
    }
  },

  mounted() {
    this.windowWidth = window.innerWidth
    window.addEventListener('resize', this.onResize)

    let url = `${this.config.discoverUrl}/datasets?limit=${this.pageSize}&offset=0`
    this.sendXhr(url)
      .then(response => {
        this.datasets = response.datasets
      })
      .catch(response => {
        this.handleXhrError(response)
      })
  },

  beforeUnmount() {
    window.removeEventListener('resize', this.onResize)
  },

  mixins: [
    Request
  ],

  data: function() {
    return {
      pageSize: 16,
      windowWidth: 0,
      datasets:[]
    }
  },

  methods: {
    onResize: function() {
      this.windowWidth = window.innerWidth
    }
  }
}
</script>

<style scoped lang="scss">

  .dataset-list {
    display: flex;
    flex-wrap: wrap;
    margin: 24px 8px;
    justify-content: space-around;
  }

</style>





