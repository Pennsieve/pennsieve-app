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
        <div v-if="showReduceSize" class="mb-24 too-large">
          <template v-if="agentCommand">
            <p>
              {{ tooLargeText }} Download it with the Pennsieve agent instead:
            </p>
            <agent-download-command v-bind="agentCommand" />
            <p class="or-remove">
              Or remove items to bring the selection under the limit:
            </p>
          </template>
          <p v-else>
            The file(s) you are trying to download exceed the limit of
            {{ formatMetric(config.maxDownloadSize) }}. Please reduce the
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
              <template #default="scope">
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
import { trackEvent, bucket } from "@/utils/analytics";
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
import { downloadServiceUrl, getFileUrl } from "@/utils/downloadService";
import AgentDownloadCommand from "../downloads/AgentDownloadCommand.vue";
import { useDownloadsStore } from "@/stores/downloadsStore";
import { triggerBrowserDownload } from "@/utils/triggerBrowserDownload";

const DEFAULT_ARCHIVE_NAME = "pennsieve-data";

export default {
  name: "BfDownloadFile",

  components: {
    AgentDownloadCommand,
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
      // download-service refused to zip the selection (413): too many
      // files or bytes, whatever the sizes here add up to.
      tooLargeForZip: false,
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
        this.tooLargeForZip ||
        this.downloadSize > this.config.maxDownloadSize ||
        this.sizeTarget.length === 0
      );
    },

    tooLargeText: function () {
      if (this.downloadSize > this.config.maxDownloadSize) {
        return `This selection is ${this.formatMetric(this.downloadSize)}, more than the ${this.formatMetric(this.config.maxDownloadSize)} you can download as a zip.`;
      }
      return "This selection is too large to download as a zip.";
    },

    /**
     * The agent command for a selection too large to zip, where downloads go
     * through download-service. Picked files download with their package.
     */
    agentCommand: function () {
      if (!downloadServiceUrl() || this.packageDTOs.length === 0) return null;
      const content = pathOr({}, [0, "content"], this.packageDTOs);
      const datasetId = content.datasetNodeId || this.$route?.params?.datasetId;
      if (!datasetId) return null;
      return {
        datasetId,
        nodeIds: this.packageDTOs.map((p) => p.content.nodeId),
        folderName:
          this.packageDTOs.length === 1 ? content.name : this.archiveName,
      };
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
      this.tooLargeForZip = false;
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
      // every download UI funnels through here; counts only, bucketed
      trackEvent('file_downloaded', {
        kind: fileDTOs ? 'files' : 'packages',
        count: bucket((fileDTOs || packageDTOs || []).length),
      });
      // A package is downloadable only when its source data actually exists
      // in storage and is retrievable. Deny by default: gating on READY
      // alone was wrong (an uploaded package rests in UPLOADED indefinitely
      // and only reaches READY when explicitly processed), but so is
      // allowing anything that isn't a known-bad state — an unrecognized or
      // future state (an ARCHIVED / SCANNING / quarantine-like state) must
      // not silently become downloadable. Failing safe with a visible "not
      // available yet" beats handing out a broken presigned URL or data
      // that isn't meant to leave storage.
      //
      // Downloadable states (see PackageState.scala):
      //   UPLOADED            - resting state of an uploaded, unprocessed package
      //   READY               - processed
      //   PROCESSING, RUNNING - source is uploaded and present during processing
      // Everything else is blocked, including placeholders (optimistic
      // upload rows) and UNAVAILABLE / PENDING / RESTORING / DELETING /
      // DELETED / INFECTED / ERROR (UPLOAD_FAILED and PROCESSING_FAILED are
      // serialized to ERROR in DTOs, so the frontend only ever sees ERROR).
      const DOWNLOADABLE_STATES = new Set([
        "UPLOADED",
        "READY",
        "PROCESSING",
        "RUNNING",
      ]);
      const notDownloadable = (packageDTOs || []).filter(
        (p) =>
          (p && p._placeholder) ||
          !DOWNLOADABLE_STATES.has(pathOr("", ["content", "state"], p))
      );
      if (notDownloadable.length > 0) {
        EventBus.$emit("toast", {
          detail: {
            type: "info",
            msg:
              notDownloadable.length === (packageDTOs || []).length
                ? "The selected file(s) aren't available for download yet."
                : "Some selected files aren't available for download and were skipped.",
          },
        });
        packageDTOs = (packageDTOs || []).filter(
          (p) => !notDownloadable.includes(p)
        );
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
      if (downloadServiceUrl()) return this.downloadViaService(pkg);
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

    /**
     * Downloads a one-file selection through download-service, which signs
     * the link and records the download. Returns false when the selection
     * isn't one file (a package with several files and none picked, which
     * the service answers with a 400), so the multi-file path runs instead.
     * A refusal (malware scan, no access) is shown, not retried as a zip.
     */
    downloadViaService: async function (pkg) {
      let fileId;
      if (this.fileDTOs) {
        if (this.fileDTOs.length !== 1) return false;
        fileId = this.fileDTOs[0].id;
      }
      const content = pkg.content || {};
      try {
        const link = await getFileUrl({
          datasetId: content.datasetNodeId || this.$route?.params?.datasetId,
          packageId: content.nodeId || content.id,
          fileId,
        });
        triggerBrowserDownload(link.url);
        return true;
      } catch (e) {
        if (e.status === 403) {
          EventBus.$emit("toast", {
            detail: {
              type: "error",
              msg: e.message.charAt(0).toUpperCase() + e.message.slice(1),
            },
          });
          return true;
        }
        return false;
      }
    },

    /**
     * Asks download-service to zip the selection. The downloads panel shows
     * its progress, and the archive downloads once it's ready; if the user
     * leaves, they're emailed instead.
     * @param {Array} nodeIds
     * @param {Array} fileIds - when downloading a single package, only these files
     */
    archiveViaService: async function (nodeIds, fileIds) {
      const content = pathOr({}, [0, "content"], this.packageDTOs);
      const archiveName = this.archiveName;
      try {
        await useDownloadsStore().start({
          datasetId: content.datasetNodeId || this.$route?.params?.datasetId,
          nodeIds,
          fileIds,
          // Several items: the name from the dialog. One folder or package:
          // its own name.
          archiveName: nodeIds.length > 1 ? archiveName : content.name,
        });
      } catch (e) {
        // Too large to zip: offer the agent instead.
        if (e.status === 413 && this.agentCommand) {
          this.archiveName = archiveName;
          this.tooLargeForZip = true;
          this.showReduceSize = true;
          this.dialogVisible = true;
          return;
        }
        const reason = e.status >= 400 && e.status < 500 && e.message
          ? e.message.charAt(0).toUpperCase() + e.message.slice(1)
          : "The download couldn't be started. Try again.";
        EventBus.$emit("toast", { detail: { type: "error", msg: reason } });
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
      if (downloadServiceUrl()) {
        this.archiveViaService(nodeIds, fileIds);
        return;
      }
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
  .too-large {
    p {
      margin: 0 0 8px;
    }
    .or-remove {
      margin-top: 16px;
    }
  }

  .download-name {
    display: flex;
    align-items: center;
    label {
      min-width: 64px;
    }
  }
}
</style>
