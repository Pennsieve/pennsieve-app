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
import BfStorageMetrics from "../../mixins/bf-storage-metrics";
import Sorter from "../../mixins/sorter";
import IconXCircle from "../icons/IconXCircle.vue";
import { useGetToken } from "@/composables/useGetToken";
import EventBus from "../../utils/event-bus";

const DEFAULT_ARCHIVE_NAME = "pennsieve-data";

export default {
  name: "BfDownloadFile",

  components: {
    IconXCircle,
    BfDialogHeader,
    DialogBody,
    BfButton,
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
    triggerDownload: async function (packageDTOs, fileDTOs) {
      // Block optimistic upload rows and packages still being processed
      // server-side. Selection is already gated (FilesTable.isRowSelectable),
      // but the toolbar + keyboard paths can still route a placeholder
      // here, and a package freshly finalized may briefly sit in
      // UPLOADED/PROCESSING before hitting READY.
      const notReady = (packageDTOs || []).filter(
        (p) =>
          (p && p._placeholder) ||
          (pathOr("", ["content", "state"], p) &&
            pathOr("", ["content", "state"], p) !== "READY")
      );
      if (notReady.length > 0) {
        EventBus.$emit("toast", {
          detail: {
            type: "info",
            msg:
              notReady.length === (packageDTOs || []).length
                ? "Files are still being processed. Download will be available once they're ready."
                : "Some selected files are still being processed and were skipped.",
          },
        });
        packageDTOs = (packageDTOs || []).filter((p) => !notReady.includes(p));
        if (packageDTOs.length === 0) return;
      }

      this.packageDTOs = packageDTOs;
      this.fileDTOs = fileDTOs;
      await this.$nextTick();
      if (this.shouldConfirmDownload) {
        this.showReduceSize = this.disableDownload;
        this.dialogVisible = true;
        return;
      }
      // Fast path: a selection that resolves to exactly one file gets a
      // direct presigned download, no zipit round-trip and no
      // pennsieve-data.zip wrapper around a single file.
      if (await this.tryDirectDownload()) {
        this.closeDialog();
        return;
      }
      const nodeIds = this.packageDTOs.map((s) => s.content.nodeId);
      if (this.fileDTOs) {
        const fileIds = this.fileDTOs.map((f) => f.id);
        this.downloadPackages(nodeIds, fileIds);
      } else {
        this.downloadPackages(nodeIds);
      }
      this.closeDialog();
    },

    /**
     * Attempts to download the selection as a single file via its presigned
     * URL. Returns true if handled; false to defer to zipit. Any unexpected
     * error is swallowed and returns false, so the zipit fallback always
     * runs — a broken fast path never blocks the existing flow.
     */
    tryDirectDownload: async function () {
      if (this.packageDTOs.length !== 1) return false;
      const pkg = this.packageDTOs[0];
      if (pathOr("", ["content", "packageType"], pkg) === "Collection") {
        return false;
      }
      const packageId = pathOr("", ["content", "id"], pkg);
      if (!packageId) return false;

      // A file-level selection short-circuits the sources lookup. Multiple
      // file selections (e.g. picking 2 sources out of a legacy multi-file
      // package) defer to zipit.
      let fileId;
      if (this.fileDTOs) {
        if (this.fileDTOs.length !== 1) return false;
        fileId = this.fileDTOs[0].id;
      } else {
        try {
          const token = await useGetToken();
          const pkgResp = await this.sendXhr(
            `${this.config.apiUrl}/packages/${packageId}?include=sources&includeAncestors=false&api_key=${token}`,
            { method: "GET", header: { Authorization: `bearer ${token}` } },
          );
          const sources = pathOr([], ["objects", "source"], pkgResp);
          // Legacy multi-file packages need to be zipped so none of the
          // extra sources get silently dropped.
          if (sources.length !== 1) return false;
          fileId = pathOr("", [0, "content", "id"], sources);
          if (!fileId) return false;
        } catch (e) {
          return false;
        }
      }

      try {
        const token = await useGetToken();
        const presigned = await this.sendXhr(
          `${this.config.apiUrl}/packages/${packageId}/files/${fileId}?api_key=${token}`,
          { method: "GET", header: { Authorization: `bearer ${token}` } },
        );
        const url = pathOr("", ["url"], presigned);
        if (!url) return false;
        const a = document.createElement("a");
        a.href = url;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return true;
      } catch (e) {
        return false;
      }
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
     * @param {Array} fileIds - when downloading a single package, includes only specified files
     */
    downloadPackages: function (nodeIds, fileIds) {
      const fileIdPayload = fileIds ? { fileIds } : {};
      const archiveNamePayload =
        this.archiveName && nodeIds.length > 1
          ? { archiveName: this.archiveName }
          : {};
      const payload = { nodeIds, ...fileIdPayload, ...archiveNamePayload };

      const form = document.createElement("form");
      form.method = "POST";
      form.action = this.zipItUrl;
      form.target = "_blank";

      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "data";
      input.value = JSON.stringify(payload);

      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
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
