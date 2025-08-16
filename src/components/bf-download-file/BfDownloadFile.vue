<template>
  <div>
    <form id="zipForm" method="POST" :action="zipItUrl">
      <input v-model="zipData" type="hidden" name="data" />
    </form>
    <form id="recordCsvForm" method="POST" :action="recordCsvUrl">
      <input v-model="recordCsvQuery" type="hidden" name="data" />
    </form>

    <el-dialog
      v-model="dialogVisible"
      data-cy="bfDownloadDialog"
      class="bf-download-dialog"
      :show-close="false"
      @close="closeDialog"
    >
      <template #header>
        <bf-dialog-header
          data-cy="bfMoveDialogTitle"
          title="Confirm Download"
        />
      </template>

      <dialog-body class="bf-download-body">
        <div v-if="showReduceSize" class="mb-24">
          <p>
            The file(s) you are trying to download exceed the limit of
            {{ formatMetric(this.config.maxDownloadSize) }}. Please reduce the
            number of files selected and try again.
          </p>
          <el-table
            :show-header="false"
            :border="false"
            :data="fileDTOs || packageDTOs"
          >
            <el-table-column prop="content.name">
              <template slot-scope="scope">
                <bf-file-label :file="scope.row" />
              </template>
            </el-table-column>
            <el-table-column prop="storage" align="right">
              <template #default>
                {{ formatMetric(scope.row.storage) }}
                <button @click="removeRow(scope.row)">
                  <IconXCircle color="#404554" :height="28" :width="28" />
                </button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div v-if="packageDTOs.length > 1" class="download-name">
          <label for="downloadName"> File Name </label>
          <el-input id="downloadName" v-model="archiveName" />
          <span>.zip</span>
        </div>
      </dialog-body>

      <template #footer>
        <bf-button
          class="secondary"
          data-cy="closeDownloadDialog"
          @click="closeDialog"
        >
          Cancel
        </bf-button>
        <bf-button
          data-cy="download"
          :disabled="disableDownload"
          @click="confirmDownload(packageDTOs, fileDTOs)"
        >
          Download
        </bf-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import { pathOr } from "ramda";
import Request from "../../mixins/request/index";
import BfDialogHeader from "../shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "../shared/dialog-body/DialogBody.vue";
import BfButton from "../shared/bf-button/BfButton.vue";
import BfFileLabel from "../datasets/files/bf-file/BfFileLabel.vue";
import BfStorageMetrics from "../../mixins/bf-storage-metrics";
import Sorter from "../../mixins/sorter";
import IconXCircle from "../icons/IconXCircle.vue";
import { useGetToken } from "@/composables/useGetToken";

const DEFAULT_ARCHIVE_NAME = "pennsieve-data";

export default {
  name: "BfDownloadFile",

  components: {
    IconXCircle,
    BfDialogHeader,
    DialogBody,
    BfButton,
    BfFileLabel,
  },

  mixins: [Sorter, Request, BfStorageMetrics],

  data() {
    return {
      zipData: "",
      dialogVisible: false,
      packageDTOs: [],
      fileDTOs: undefined,
      recordCsvQuery: "",
      archiveName: DEFAULT_ARCHIVE_NAME,
      showReduceSize: false,
      downloadConfirmed: false,
      zipItUrl: "",
      recordCsvUrl: "",
    };
  },
  mounted() {
    useGetToken()
      .then((token) => {
        this.zipItUrl = `${this.config.zipitUrl}/?api_key=${token}`;
        const activeOrgIntId = pathOr(
          "",
          ["organization", "intId"],
          this.activeOrganization
        );
        this.recordCsvUrl = `${this.config.apiUrl}/models/v2/organizations/${activeOrgIntId}/search/records/csv?api_key=${token}`;
      })
      .catch((error) => {
        console.error("Failed to fetch token:", error);
      });
  },
  computed: {
    ...mapGetters(["config"]),

    ...mapState(["activeOrganization"]),

    sizeTarget: function () {
      return this.fileDTOs || this.packageDTOs;
    },

    /**
     * sums the "storage" property on each row to get a total download size
     */
    downloadSize: function () {
      return this.sizeTarget.reduce((total, row) => {
        total = total + row.storage;
        return total;
      }, 0);
    },

    /**
     * download is disabled if the total size is greater than the threshold, or no rows are selected
     */
    disableDownload: function () {
      return (
        this.downloadSize > this.config.maxDownloadSize ||
        this.sizeTarget.length === 0
      );
    },

    /**
     * determines whether the confirm download dialog should open
     */
    shouldConfirmDownload: function () {
      return (
        this.disableDownload ||
        (this.packageDTOs.length > 1 && !this.downloadConfirmed)
      );
    },
  },

  methods: {
    /**
     * Closes the dialog and initializes state
     */
    closeDialog: function () {
      this.archiveName = DEFAULT_ARCHIVE_NAME;
      this.downloadConfirmed = false;
      this.showReduceSize = false;
      this.dialogVisible = false;
    },

    /**
     * removes a row from the dialog
     */
    removeRow: function (row) {
      if (this.fileDTOs) {
        this.fileDTOs = this.fileDTOs.filter((f) => f.id !== row.id);
      } else {
        this.packageDTOs = this.packageDTOs.filter(
          (p) => p.content.id !== row.content.id
        );
      }
    },

    confirmDownload(packageDTOs, fileDTOs) {
      this.downloadConfirmed = true;
      this.triggerDownload(packageDTOs, fileDTOs);
    },

    /**
     * either directly begins downloading, or renders the popup when the size is too large
     * @param packageDTOs an array of package DTO's (or file DTO's with content.name, such that things render properly)
     * @param fileDTOs optional - indicates that we are downloading files, NOT packages
     *     represents the parent package of those files
     */
    triggerDownload: function (packageDTOs, fileDTOs) {
      console.log("triggerDownload Runs");
      this.packageDTOs = packageDTOs;
      this.fileDTOs = fileDTOs;
      this.$nextTick(() => {
        if (this.shouldConfirmDownload) {
          this.showReduceSize = this.disableDownload;
          this.dialogVisible = true;
        } else {
          const nodeIds = this.packageDTOs.map((s) => s.content.nodeId);
          if (this.fileDTOs) {
            const fileIds = this.fileDTOs.map((f) => f.id);
            this.downloadPackages(nodeIds, fileIds);
          } else {
            this.downloadPackages(nodeIds);
          }
          this.closeDialog();
        }
      });
    },

    triggerRecordCsvDownload: function (query) {
      this.recordCsvQuery = JSON.stringify(query);
      this.$nextTick(() => {
        // eslint-disable-next-line no-undef
        recordCsvForm.submit();
      });
    },

    /**
     * downloads multiple packages
     * @param {Array} nodeIds
     * @param {Array} fileIds
     */
    downloadPackages: async function (nodeIds, fileIds) {
      const fileIdPayload = fileIds ? { fileIds } : {};
      const archiveNamePayload =
        this.archiveName && nodeIds.length > 1
          ? { archiveName: this.archiveName }
          : {};
      const payload = { nodeIds, ...fileIdPayload, ...archiveNamePayload };

      try {
        const token = await useGetToken();
        const response = await fetch(
          `${this.config.zipitUrl}/?api_key=${token}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            mode: "cors",
          }
        );

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${this.archiveName}.zip`;
          a.click();
          window.URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.error("Download failed:", error);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@use "../../styles/theme";
@use "../../styles/element/dialog";

.bf-download-body {
  .download-name {
    display: flex;
    align-items: center;
    label {
      min-width: 64px;
    }
  }
}
</style>
