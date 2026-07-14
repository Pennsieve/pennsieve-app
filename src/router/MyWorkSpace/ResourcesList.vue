<template>
  <bf-stage>
    <div class="resources">
      <div class="resources-head">
        <h2>Resources</h2>
        <p class="resources-sub">
          Shared catalogs you can browse and reuse across your datasets.
        </p>
      </div>

      <div class="graph-management-cards">
        <button @click="open('cde-catalog')">
          <bf-card
            title="CDE Catalog"
            card-copy="Browse common data elements and bundles"
          >
            <template #icon>
              <icon-collection class="card-icon" :height="48" :width="48" />
            </template>
          </bf-card>
        </button>

        <button class="card-disabled" disabled>
          <bf-card
            title="Model Templates"
            card-copy="Browse reusable model templates — coming soon"
          >
            <template #icon>
              <icon-overview class="card-icon" :height="48" :width="96" />
            </template>
          </bf-card>
        </button>
      </div>
    </div>
  </bf-stage>
</template>

<script>
import BfCard from "@/components/shared/bf-card/BfCard.vue";
import IconCollection from "@/components/icons/IconCollection.vue";
import IconOverview from "@/components/icons/IconOverview.vue";

export default {
  name: "ResourcesList",
  components: { BfCard, IconCollection, IconOverview },
  methods: {
    open(name) {
      this.$router.push({ name });
    }
  }
};
</script>

<style scoped lang="scss">
@use '@/styles/theme';

.resources-head {
  margin-bottom: 24px;
}
.resources-sub {
  color: theme.$gray_4;
  margin-top: 4px;
}
.graph-management-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 48px;
}
button {
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
}
.card-disabled {
  opacity: 0.5;
  cursor: default;
}
.card-icon {
  color: theme.$purple_2;
}
</style>
