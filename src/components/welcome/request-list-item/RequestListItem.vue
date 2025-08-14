<template>
  <div class="repository-list-item" @click="triggerRequest(DatasetProposalAction.EDIT)">

    <el-row
      type="flex"
      align="middle"
      class="info"
    >
      <el-col
        :sm="12"
      >
        <el-row
          type="flex"
          align="middle"
        >
          <div class="repository-type" >
            {{statusStr}}
          </div>

        </el-row>

        <el-row>
          <div class="repository-title" >
              {{datasetRequest.name}}
          </div>
        </el-row>
        <el-row>
          <p class="repository-description">
            {{datasetRequest.description.substring(0,239)}}
          </p>
        </el-row>
      </el-col>
      <el-col
        class = "option-col"
        :sm="8"
        >
        <!--
        <template v-if="datasetRequest.proposalStatus === 'DRAFT'">
          <a
            href="#"
            @click.prevent="triggerRequest(DatasetProposalAction.EDIT)"
          >
            Edit Request
          </a>
        </template>
        -->
        <template v-if="datasetRequest.proposalStatus === 'DRAFT' && readyToSubmit">
          <a
            href="#"
            @click.stop="triggerRequest(DatasetProposalAction.SUBMIT)"
          >
            Submit Request
          </a>
        </template>
        <template v-if="datasetRequest.proposalStatus === 'DRAFT'">
          <a
            href="#"
            @click.stop="triggerRequest(DatasetProposalAction.REMOVE)"
          >
            Remove Request
          </a>
        </template>
        <template v-if="datasetRequest.proposalStatus === 'ACCEPTED'">
          <a
            href="#"
            @click.stop="triggerRequest(DatasetProposalAction.OPEN_DATASET)"
          >
            Open Dataset
          </a>
        </template>
        <template v-if="datasetRequest.proposalStatus === 'SUBMITTED'">
          <a
            href="#"
            @click.stop="triggerRequest(DatasetProposalAction.WITHDRAW)"
          >
            Retract Request
          </a>
        </template>
        <template v-if="datasetRequest.proposalStatus === 'REJECTED'">
          <a
            href="#"
            @click.stop="triggerRequest(DatasetProposalAction.RESUBMIT)"
          >
            Resubmit To...
          </a>
        </template>


      </el-col>
      <el-col
        :sm="4">
        <el-row
          type="flex"
          align="bottom"
          class="logo-wrapper">
          <img
            :src=logoPath
            class="logo"
            alt="Logo for Pennsieve"
          />
        </el-row>

      </el-col>
    </el-row>

  </div>


  <!--  </div>-->
</template>

<script>

import {
  mapActions, mapGetters,
} from 'vuex'
import {find, propEq, propOr} from "ramda";
import FormatDate from '../../../mixins/format-date'
import { DatasetProposalAction } from '../../../utils/constants';

export default {
  name: 'RequestListItem',

  components: {
  },
  mixins: [
    FormatDate,
  ],

  props: {
    datasetRequest: {
      type: Object,
      default: () => ({})
    },
  },

  computed: {
    ...mapGetters('repositoryModule',[
      'getRepositoryByNodeId',
    ]),
    logoPath: function() {
      if (this.datasetRequest) {
        let repository = this.getRepositoryByNodeId(this.datasetRequest.organizationNodeId)
        if (repository) {
          return repository.logoFile
        }
      }
      return ""
    },
    statusStr: function() {
      return this.datasetRequest.proposalStatus.toUpperCase();
    },
    readyToSubmit: function() {
      let validName = this.datasetRequest.name !== null && this.datasetRequest.name !== ""
      let validDescription = this.datasetRequest.description !== null && this.datasetRequest.description !== ""
      let surveyCompleted = this.surveyComplete()
      return validName && validDescription && surveyCompleted
    },
    DatasetProposalAction: function() {
      return DatasetProposalAction
    },
  },

  data: function () {
    return {
    }
  },
  mounted() {
  },
  watch: {
  },
  methods: {
    ...mapActions('repositoryModule',[
        'updateRequestModalVisible',
        'setRepositoryDescription',
      ]
    ),
    openInfoPanel: function(event) {
      this.$emit("open", this.datasetRequest)
    },
    surveyComplete: function() {
      let result = false
      let organizationNodeId = this.datasetRequest.organizationNodeId
      let repository = this.getRepositoryByNodeId(organizationNodeId)
      if (repository && repository.questions != null && this.datasetRequest && this.datasetRequest.survey != null) {
        // for each question in repository.questions
        // check whether this.datasetRequest.survey contains an object with the same questionId
        // and check whether the response is not null and not the empty string
        result = repository.questions.map(q => {
          let answer = this.datasetRequest.survey.find(r => r.questionId === q.id)
          return answer && answer.response !== ""
        }).reduce((a,c) => a && c, true)
      }
      return result
    },
    triggerRequest: function(request) {
      this.$emit(request, this.datasetRequest)
    },
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/theme';

.logo-wrapper {
  justify-content: flex-end;
  .logo {
    height: 40px;
    width: auto;
  }
}

.option-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 24px;
}

.repository-menu {
  width: 24px;
}

.repository-list-item {
  border-bottom: 1px solid theme.$gray_3;
  margin: 0 0 16px 0;
  //padding:  16px 24px 8px 24px;
  background-color: white;
  display:flex;
  flex-direction: column;
  cursor: pointer;

  :hover {
    background-color: theme.$purple-tint;
  }

  .info {
    padding:  16px 24px 8px 24px;
  }

}
.repository-title {
  font-size: 16px;
  margin-bottom: 8px;
  color: theme.$purple_3;
}

.repository-type {
  color: theme.$gray_5;
  font-weight: 500;
  font-size: 12px;
}

.repository-description {
  font-size: 12px;
  color: theme.$gray_5;
  min-height: 3em;
  max-width: 650px;
}

.list-item-col-spacer {
  padding-top: 32px;
}

</style>
