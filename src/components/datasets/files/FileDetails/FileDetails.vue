<template>
  <bf-stage slot="stage" ref="bfStage" :is-editing="editingInstance">
    <template #actions>
      <stage-actions>
        <template #right>
          <link-record-menu
            v-if="getPermission('editor')"
            class="mr-8"
            :relationships="linkRecordOptions"
            :show-existing-file="!isFile"
            @menu-click="onLinkRecordMenuClick"
          />

          <bf-button
            :disabled="isUploading || isFileProcessing"
            class="primary mr-8 flex"
            data-cy="btnDownloadFiles"
            @click="downloadFile"
          >
            Download
          </bf-button>

          <el-dropdown
            v-if="getPermission('editor')"
            trigger="click"
            placement="bottom-end"
            @command="onOverflowMenuClick"
          >
            <bf-button :disabled="datasetLocked" class="icon el-dropdown-link">
              <IconMenu />
            </bf-button>
            <template #dropdown>
              <el-dropdown-menu slot="dropdown" class="bf-menu">
                <template v-if="isFile === false">
                  <el-dropdown-item
                    v-if="getPermission('manager')"
                    class="bf-menu-item"
                    command="addProperty"
                  >
                    Add Property
                  </el-dropdown-item>

                  <el-dropdown-item
                    v-if="getPermission('editor')"
                    class="bf-menu-item"
                    command="archive"
                  >
                    Delete
                  </el-dropdown-item>
                </template>
                <template v-else>
                  <el-dropdown-item
                    v-if="!isExternalFile"
                    class="bf-menu-item"
                    :disabled="datasetLocked"
                    command="rename-file"
                  >
                    Rename
                  </el-dropdown-item>

                  <el-dropdown-item
                    v-else
                    class="bf-menu-item"
                    :disabled="datasetLocked"
                    command="edit-file"
                  >
                    Update
                  </el-dropdown-item>

                  <el-dropdown-item
                    class="bf-menu-item"
                    :disabled="datasetLocked"
                    command="move-file"
                  >
                    Move
                  </el-dropdown-item>

                  <el-dropdown-item
                    class="bf-menu-item"
                    :disabled="datasetLocked"
                    command="delete-file"
                  >
                    Delete
                  </el-dropdown-item>
                </template>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </stage-actions>
    </template>

    <div class="concept-instance-section">
      <div files-section class="file-list">
        <concept-instance-static-property
          class="highlight-property"
          :label="fileNameLabel"
          :helpUrl="computePackageHelpUrl"
        >
          {{ packageDisplayName }}
        </concept-instance-static-property>

        <concept-instance-static-property :label="fileTypeLabel">
          {{ fileType }}
        </concept-instance-static-property>

        <concept-instance-static-property :label="fileStatusLabel">
          {{ getDisplayFileStatus }}
        </concept-instance-static-property>

        <concept-instance-static-property label="Location">
          <router-link :to="fileLocation.route">
            {{ fileLocation.path }}
          </router-link>
        </concept-instance-static-property>

        <concept-instance-static-property label="file size">
          {{ fileSize }}
        </concept-instance-static-property>

        <concept-instance-static-property label="Pennsieve id">
          {{ fileId }}
        </concept-instance-static-property>

        <concept-instance-static-property
          label="Created by"
          :user="ownerId"
          :date="proxyRecord.content.createdAt"
        />
      </div>
    </div>

    <el-collapse
      v-if="hasMultipleSourceFiles"
      key="sourcefiles"
      v-model="activeSections"
      class="zero-padding concept-instance-section source-file-table-properties source-files no-border"
    >
      <source-files-table
        class="source-files-table"
        id="Source Files"
        ref="package"
        :active-sections="activeSections"
        :display-name="'Source Files'"
        :show-collapse="true"
        source-type="sourceFile"
        :url="sourceFilesUrl"
        :proxy-record="proxyRecord"
      />
    </el-collapse>

    <!--        &lt;!&ndash; BEGIN PROPERTIES TABLE &ndash;&gt;-->
    <!--        <div class="property-list"-->
    <!--           v-if="!isFile && !isRecordsLoading">-->
    <!--          <concept-instance-property-->
    <!--            v-for="property in properties"-->
    <!--            :key="property.name"-->
    <!--            :property="property"-->
    <!--            :string-subtypes="stringSubtypes"-->
    <!--            @edit-instance="enableEditFocus(property.name)"-->
    <!--          />-->

    <!--          <concept-instance-linked-property-->
    <!--            v-for="property in linkedProperties"-->
    <!--            :key="property.to.modelId"-->
    <!--            :property="property"-->
    <!--            :label="property.schemaLinkedProperty.displayName"-->
    <!--            @edit-linked-property="editLinkedProperty"-->
    <!--            @confirm-remove-linked-property="openLinkedPropertyModal"-->
    <!--          />-->

    <!--          <div class="static-prop-section">-->
    <!--            <concept-instance-static-property-->
    <!--              label="Pennsieve id"-->
    <!--              :value="instance.id"-->
    <!--            />-->

    <!--            <concept-instance-static-property-->
    <!--              label="Created by"-->
    <!--              :user="instance.createdBy"-->
    <!--              :date="instance.createdAt"-->
    <!--            />-->

    <!--            <concept-instance-static-property-->
    <!--              label="Updated by"-->
    <!--              :user="instance.updatedBy"-->
    <!--              :date="instance.updatedAt"-->
    <!--            />-->
    <!--          </div>-->
    <!--        </div>-->
    <!--        &lt;!&ndash; END PROPERTIES TABLE &ndash;&gt;-->

    <!--        &lt;!&ndash; BEGIN FILES TABLE EMPTY STATE &ndash;&gt;-->
    <!--        <template-->
    <!--          v-if="!isFile && !isFilesLoading && !hasFiles && !isRecordsLoading && !datasetLocked"-->
    <!--        >-->
    <!--          <el-collapse-->
    <!--            v-if="getPermission('editor')"-->
    <!--            key="package"-->
    <!--            v-model="activeSections"-->
    <!--            class="concept-instance-section files-empty-state"-->
    <!--          >-->
    <!--            <el-collapse-item-->
    <!--              title="Files"-->
    <!--              name="package"-->
    <!--            >-->
    <!--              <div-->
    <!--                slot="title"-->
    <!--                class="relationship-title"-->
    <!--              >-->
    <!--                <svg-icon-->
    <!--                  name="icon-arrow-up"-->
    <!--                  :dir="arrowDirection('package')"-->
    <!--                  height="10"-->
    <!--                  width="10"-->
    <!--                  color="#404554"-->
    <!--                />-->
    <!--                <h2>Files</h2>-->
    <!--              </div>-->

    <!--              <div-->
    <!--                class="bf-upload-dropzone"-->
    <!--                :class="isDraggingFiles ? 'is-dragging' : ''"-->
    <!--                @dragenter.prevent="setIsDragging(true)"-->
    <!--                @dragover.prevent="setIsDragging(true)"-->
    <!--                @dragleave.prevent="setIsDragging(false)"-->
    <!--                @drop.prevent="onDrop"-->
    <!--              >-->
    <!--                <div class="dropzone-content">-->
    <!--                  <div class="upload-icons-wrap">-->
    <!--                    <img-->
    <!--                      class="svg-icon icon-item pdf icon-upload-extra outside"-->
    <!--                      :src="fileIcon('PDF', 'PDF')"-->
    <!--                    >-->

    <!--                    <img-->
    <!--                      class="svg-icon icon-item timeseries icon-upload-extra outside"-->
    <!--                      :src="fileIcon('Timeseries', 'TimeSeries')"-->
    <!--                    >-->

    <!--                    <iron-icon-->
    <!--                      class="icon-upload"-->
    <!--                      icon="blackfynn:icon-upload"-->
    <!--                    />-->

    <!--                    <img-->
    <!--                      class="svg-icon icon-item image icon-upload-extra outside"-->
    <!--                      :src="fileIcon('Image', 'Image')"-->
    <!--                    >-->

    <!--                    <img-->
    <!--                      class="svg-icon icon-item slide icon-upload-extra outside"-->
    <!--                      :src="fileIcon('Microscope', 'Slide')"-->
    <!--                    >-->
    <!--                  </div>-->
    <!--                  <h3>-->
    <!--                    Drag and drop files here or-->
    <!--                    <a-->
    <!--                      href="#"-->
    <!--                      @click.prevent="handleChooseExistingFiles"-->
    <!--                    >-->
    <!--                      choose your files.-->
    <!--                    </a>-->
    <!--                  </h3>-->
    <!--                  <p>-->
    <!--                    We don’t recommend uploading more than 10GB through the web UI, due to browser-->
    <!--                    limitations. If you’re uploading large amounts of data, please use the-->
    <!--                    <a-->
    <!--                      href="https://docs.pennsieve.io/"-->
    <!--                      target="_blank"-->
    <!--                    >-->
    <!--                      Pennsieve API-->
    <!--                    </a>-->
    <!--                    .-->
    <!--                  </p>-->
    <!--                </div>-->
    <!--                <input-->
    <!--                  ref="inputFile"-->
    <!--                  class="visuallyhidden"-->
    <!--                  type="file"-->
    <!--                  multiple="multiple"-->
    <!--                  @change="onInputFileChange"-->
    <!--                >-->
    <!--              </div>-->
    <!--            </el-collapse-item>-->
    <!--          </el-collapse>-->
    <!--        </template>-->
    <!--        &lt;!&ndash; END FILES TABLE EMPTY STATE &ndash;&gt;-->

    <!-- BEGIN FILES TABLE -->
    <!--        <template v-if="!editingInstance && hasFiles">-->
    <!--          <el-collapse-->
    <!--            v-model="activeSections"-->
    <!--            class="concept-instance-section zero-padding no-border"-->
    <!--          >-->
    <!--            <relationships-table-->
    <!--              id="Files"-->
    <!--              ref="package"-->
    <!--              :active-sections="activeSections"-->
    <!--              :relationship="fileRelationship"-->
    <!--              :show-collapse="true"-->
    <!--              source-type="recordFile"-->
    <!--              :url="getRecordFileRelationshipsUrl"-->
    <!--              @remove-relationships="handleRemoveRelationships"-->
    <!--              @set-related-files="handleSetRelatedFiles"-->
    <!--              @unlink-files="handleUnlinkFiles"-->
    <!--              @delete-files="handleDeleteFiles"-->
    <!--            />-->
    <!--          </el-collapse>-->
    <!--        </template>-->
    <!-- END FILES TABLE -->

    <!-- Directory View -->
    <!--        <el-collapse-->
    <!--          v-if="displayDirectoryViewer"-->
    <!--          key="filecontent"-->
    <!--          v-model="activeSections"-->
    <!--          class="concept-instance-section zero-padding no-border"-->
    <!--        >-->
    <!--          <el-collapse-item-->
    <!--            name="filecontent"-->
    <!--            title="File Content"-->
    <!--          >-->
    <!--            <div-->
    <!--              slot="title"-->
    <!--              class="relationship-title"-->
    <!--            >-->
    <!--              <svg-icon-->
    <!--                class="icon-collapse"-->
    <!--                name="icon-arrow-up"-->
    <!--                :dir="arrowDirection('filecontent')"-->
    <!--                height="10"-->
    <!--                width="10"-->
    <!--                color="#404554"-->
    <!--              />-->
    <!--              <h2>File Content</h2>-->
    <!--            </div>-->
    <!--            <directory-viewer :pkg="proxyRecord" />-->
    <!--          </el-collapse-item>-->
    <!--        </el-collapse>-->

    <!-- Relationships Table Empty State -->
<!--    <div-->
<!--      v-if="!hasSeenRelationshipsInfo && !hasRelationships && !datasetLocked"-->
<!--      class="relationships-empty-state"-->
<!--    >-->
<!--      <div class="relationships-empty-state-inner">-->
<!--        <h3>Create Relationships</h3>-->
<!--        <div>-->
<!--          <p class="relationship-inner-text">-->
<!--            Connect <b>{{ $sanitize(formattedConceptTitle) }}</b> with other-->
<!--            objects in your graph by clicking the "Link to ..." button above.-->
<!--          </p>-->
<!--          <a-->
<!--            href="https://docs.pennsieve.io/docs/creating-links-between-metadata-records"-->
<!--            target="_blank"-->
<!--          >-->
<!--            <bf-button class="primary learn-more"> Learn More </bf-button>-->
<!--          </a>-->
<!--          <div>-->
<!--            <a href="#" @click.prevent="dismissRelationshipsInfo"> Got it </a>-->
<!--          </div>-->
<!--        </div>-->
<!--      </div>-->
<!--    </div>-->

    <!-- BEGIN RELATIONSHIPS TABLE -->
    <template v-if="hasRelationships">
      <el-collapse
        v-for="relationship in relationshipsModels"
        :key="relationship.name"
        v-model="activeSections"
        class="concept-instance-section zero-padding no-border"
      >
        <relationships-table
          :id="relationship.displayName"
          :ref="relationship.name"
          :active-sections="activeSections"
          :relationship="relationship"
          :show-collapse="true"
          :dataset-id="datasetId"
          :can-add-relationship="false"
          :package-id="fileId"
          :url="getRecordRelationshipsUrl(relationship.name)"
          @remove-relationships="handleRemoveRelationships"
        />
      </el-collapse>
    </template>

<!--    <add-relationship-drawer-->
<!--      ref="addRelationshipDrawer"-->
<!--      :relationship-types="relationshipTypes"-->
<!--      :record="proxyRecord.content"-->
<!--      :record-name="drawerOriginatingName"-->
<!--      :is-file="true"-->
<!--    />-->

    <div class="viewer-pane-wrap">
      <div class="header">
        <div>Preview</div>
        <bf-button
          v-if="isMSOfficeFile"
          class="primary"
          @click="openMSOfficeFile"
        >
          Open with Office 365
        </bf-button>
        <bf-button
          v-else
          class="primary"
          :disabled="!isOpenViewerBtnEnabled"
          @click="openViewer"
        >
          Open Full Viewer
        </bf-button>
      </div>

      <!-- Show preview of viewer-->
      <viewer-pane class="viewer-pane" :is-preview="true" :pkg="proxyRecord" />
    </div>
  </bf-stage>


</template>

<script>
import { mapGetters, mapActions, mapState } from "vuex";
import {
  head,
  propOr,
  clone,
  pathOr,
  find,
  propEq,
  flatten,
  prop,
  compose,
  pluck,
  map,
  reject,
  findIndex,
  pick,
  defaultTo,
  uniq,
  join,
  prepend,
  reverse,
  path,
  pathEq,
  uniqBy,
  isNil,
  isEmpty,
} from "ramda";

import BfButton from "../../../shared/bf-button/BfButton.vue";
import AddRelationshipDrawer from "../../explore/ConceptInstance/AddRelationshipDrawer.vue";
import ConceptInstanceStaticProperty from "../../explore/ConceptInstance/ConceptInstanceStaticProperty.vue";
import LinkRecordMenu from "../../../shared/LinkRecordMenu/LinkRecordMenu.vue";
import GetFileProperty from "../../../../mixins/get-file-property";
import RelationshipsTable from "../../explore/ConceptInstance/RelationshipsTable.vue";
import EventBus from "../../../../utils/event-bus";
import Request from "../../../../mixins/request";
import StorageMetrics from "../../../../mixins/bf-storage-metrics";
import FileIcon from "../../../../mixins/file-icon";
import IconMenu from "../../../icons/IconMenu.vue";
import StageActions from "../../../shared/StageActions/StageActions.vue";
import SourceFilesTable from "./SourceFilesTable.vue";
import ViewerPane from "../../../viewer/ViewerPane/ViewerPane.vue";
import FileTypeMapper from "../../../../mixins/FileTypeMapper";
import { viewerToolTypes } from "../../../../utils/constants";
import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";

export default {
  name: "FileDetails",

  components: {
    ViewerPane,
    SourceFilesTable,
    StageActions,
    IconMenu,
    BfButton,
    ConceptInstanceStaticProperty,
    LinkRecordMenu,
    RelationshipsTable,
    AddRelationshipDrawer,
  },

  mixins: [Request, StorageMetrics, FileIcon, GetFileProperty, FileTypeMapper],

  props: {
    datasetId: {
      type: String,
      default: "",
    },
    fileId: {
      type: String,
      default: "",
    },
  },

  data() {
    return {
      addEditPropertyDialogVisible: false,
      archiveDialogVisible: false,
      activeSections: [
        "properties",
        "package",
        "recordfiles",
        "sourcefiles",
        "filecontent",
        "fileRelationships",
      ],
      linkBackObject: {
        path: "",
        name: "Records",
      },
      relationships: [],
      isAddingFiles: true,
      isDraggingFiles: false,
      isFilesLoading: false,
      isRecordsLoading: false,
      showInfo: true,
      linkDropdownOpen: false,
      proxyRecord: {
        content: {},
        properties: [],
      },
      instance: {
        type: "",
        values: [],
        createdAt: "",
        updatedAt: "",
        createdBy: 0,
        updatedBy: 0,
        id: "",
      },
      errorProperties: [],
      originalProperties: [],
      savingChanges: false,
      hasSeenRelationshipsInfo: false,
      schema: [],
      relatedFiles: [],
      moveConflict: {},
      selectedFiles: [],
      arrayValues: {},
      relationshipTypes: [],
      linkedProperties: [],
      selectedLinkedProperty: {},
      unlinkDialogVisible: false,
      unlinkFileData: {},
      isUnlinkFileDialogVisible: false,
      relationshipNameTruncated: false,
      packageSourceFiles: {},
      isDisabled: false,
      stringSubtypes: [],
    };
  },

  computed: {
    ...mapGetters([
      "config",
      "concepts",
      "lastRoute",
      "editingInstance",
      "getModelById",
      "hasFeature",
      "getPermission",
      "datasetLocked",
      "isOrgSynced",
    ]),

    ...mapState(["conceptsHash", "dataset"]),

    /**
     * Compute the display name which will decode
     * the response from the API
     * @returns {String}
     */
    packageDisplayName: function () {
      const name = this.proxyRecord.content.name;
      return name ? name : "";
    },

    /**
     * Compute if the open viewer
     * button should be enabled
     * @returns {Boolean}
     */
    isOpenViewerBtnEnabled: function () {
      return (
        this.checkViewerType(this.proxyRecord) !== "UnknownViewer" &&
        !this.isUploading &&
        this.getFileStatus !== "Failed" &&
        this.computePackageType !== "Unknown" &&
        !this.displayDirectoryViewer &&
        this.fileType !== "External File"
      );
    },

    /**
     * Compute url to export file
     * @returns {String}
     */
    exportFileUrl: async function () {
      return useGetToken().then(token => {
        const packageId = pathOr("", ["content", "id"], this.proxyRecord);
        return `${this.config.apiUrl}/packages/${packageId}/export?api_key=${token}`;
      })

    },

    /**
     * Compute the package type
     * @returns {String}
     */
    computePackageType: function () {
      return pathOr("", ["content", "packageType"], this.proxyRecord);
    },

    ownerId: function () {
      return pathOr(0, ["content", "ownerId"], this.proxyRecord);
    },
    fileTypeLabel: function () {
      return this.packageSourceFiles.length > 1 ? "Package type" : "File type";
    },
    fileNameLabel: function () {
      return this.packageSourceFiles.length > 1 ? "Package name" : "File name";
    },
    computePackageHelpUrl: function () {
      return this.packageSourceFiles.length > 1
        ? "https://docs.pennsieve.io/docs/what-is-a-package-and-what-are-source-files"
        : null;
    },
    fileStatusLabel: function () {
      return this.packageSourceFiles.length > 1
        ? "Package status"
        : "File status";
    },

    /**
     * Compute whether or not to display detailed directory view
     * @returns {Boolean}
     */
    displayDirectoryViewer: function () {
      const packageType = pathOr(
        "",
        ["content", "packageType"],
        this.proxyRecord
      ).toLowerCase();
      return (
        (packageType === "hdf5" || packageType === "zip") &&
        this.getFileStatus === "Processed"
      );
    },

    /**
     * Compute property to display file breadcrumb link
     * @returns {String}
     */
    fileBreadcrumbLink: function () {
      return this.fileLocation.route;
    },

    /**
     * Computed property to display breadcrumb for file details
     * @returns {String}
     */
    fileBreadcrumbText: function () {
      return "Files";
    },

    /**
     * Computed property to generate API Url for source files table
     * @returns {String}
     */
    packageFilesUrl: async function () {
      return useGetToken().then(token => {
        const url = pathOr("", ["config", "apiUrl"])(this);
        const packageId = this.fileId;
        return `${url}/packages/${packageId}/sources-paged?api_key=${token}`;
      })
    },

    sourceFilesUrl: function () {
      const url = pathOr("", ["config", "apiUrl"])(this);

      const packageId = this.fileId;
      return `${url}/packages/${packageId}/sources-paged`;
    },

    /**
     * Computed property to retrieve file status for source
     * files in package
     * @returns {String}
     */
    getFileStatus: function () {
      const states = {
        UPLOADED: "Unprocessed",
        ERROR: "Failed",
        PROCESSING: "Processing",
        RUNNING: "Processing",
        PENDING: "Processing",
        READY: "Processed",
        UNAVAILABLE: "Uploading",
      };

      const fileState = path(["content", "state"], this.proxyRecord);
      return states[fileState];
    },

    /**
     * Computed property to display the correct file status
     * in the File Details table
     * @returns {String}
     */
    getDisplayFileStatus: function () {
      return this.computePackageType === "Unknown" &&
        this.getFileStatus === "Processed"
        ? "Processed: Unable to View"
        : this.getFileStatus;
    },

    /**
     * Computed property that checks if source files table
     * should be displayed
     * @returns {Boolean}
     */
    hasMultipleSourceFiles: function () {
      return this.packageSourceFiles.length > 1 ? true : false;
    },

    /**
     * Computed property to format kind column in table
     * @returns {String}
     */
    kind: function () {
      const packageType = pathOr("", ["content", "packageType"], this.file);

      if (packageType === "Collection") {
        return "Folder";
      }

      const subtype = this.getFilePropertyVal(this.file.properties, "subtype");
      return subtype ? subtype : propOr("Unknown", "subtype", this.file);
    },

    /**
     * Computed property returns formatted Created Date for table
     * @returns {String}
     */
    createdDate: function () {
      return this.formatDate(this.file.content.createdAt);
    },
    /**
     * * Compute external file object
     * @returns {Object}
     */
    externalFile: function () {
      return propOr({}, "externalFile", this.proxyRecord);
    },

    /**
     * Compute if package is an external file
     * @returns {Boolean}
     */
    isExternalFile: function () {
      return Boolean(
        pathOr("", ["externalFile", "location"], this.proxyRecord)
      );
    },

    /**
     * Compute if external file is a url or local file path
     * @returns {Boolean}
     */
    isExternalFileClickable: function () {
      const location = pathOr(
        "",
        ["externalFile", "location"],
        this.proxyRecord
      );
      return Boolean(validUrl.isUri(location));
    },

    /**
     * Open Viewer CTA
     * @returns {String}
     */
    buttonText: function () {
      let states = {};

      if (this.isMSOfficeFile) {
        states = {
          Unprocessed: "Process",
          Processed: "Open with Office 365",
          Processing: "Processing",
          Failed: "Open with Office 365",
          Uploading: "Uploading",
        };
      } else {
        states = {
          Unprocessed: "Process",
          Processed: "Open Viewer",
          Processing: "Processing",
          Failed: "Open Viewer",
          Uploading: "Uploading",
        };
      }

      states[this.getFileStatus] === "Processing"
        ? (this.isDisabled = true)
        : (this.isDisabled = false);

      return states[this.getFileStatus];
    },

    /**
     * Generates function call for button on file details page
     * based on file state
     */
    buttonMenu: function () {
      let menu = {};
      if (this.isMSOfficeFile) {
        menu = {
          Unprocessed: this.processFile,
          Processed: this.openMSOfficeFile,
        };
      } else {
        menu = {
          Unprocessed: this.processFile,
          Processed: this.openViewer,
        };
      }
      return menu[this.getFileStatus];
    },

    /**
     * Compute if the file is processing
     * @returns {Boolean}
     */
    isFileProcessing: function () {
      const isProcessing = ["UNAVAILABLE", "PENDING", "RUNNING", "PROCESSING"];
      const state = path(["content", "state"], this.proxyRecord);
      return isProcessing.indexOf(state) >= 0;
    },

    /**
     * Compute if the file is uploading
     * @returns {Boolean}
     */
    isUploading: function () {
      const state = path(["content", "state"], this.proxyRecord);
      return state == "UNAVAILABLE";
    },

    /**
     * Get move URL
     * @returns {String}
     */
    moveUrl: async function () {
      return useGetToken().then(token => {
        return `${this.config.apiUrl}/data/move?api_key=${token}`;
      })
    },

    /**
     * Computes whether or not dataset has files
     * @returns {Boolean}
     */
    datasetHasFiles: function () {
      const storage = propOr(0, "storage", this.dataset);
      return storage > 0;
    },

    /**
     * Computes formatted display value for concept title
     * @returns {String}
     */
    formattedConceptTitle: function () {
      if (this.conceptTitle) {
        return this.formatUniqueDisplayValues(this.conceptTitle);
      }
      return "";
    },

    /**
     * Computes data type for concept title
     * @returns {String}
     */
    dataType: function () {
      return this.getRawDataType(this.conceptTitle);
    },

    /**
     * GET url for package details
     * @returns {String}
     */
    packageDetailsUrl: async function () {
      return await useGetToken().then(token => {
        return `${this.config.apiUrl}/packages/${this.fileId}?api_key=${token}&includeAncestors=true`;

      })
    },

    /**
     * Check if Concept has Files
     * @returns {Boolean}
     */
    hasFiles: function () {
      const relationships = propOr([], "relationships")(this);
      if (relationships.length > 0) {
        const idx = this.relationships.findIndex(
          (rel) => rel.displayName === "Files"
        );
        return idx >= 0;
      }
      this.loadRecordsPage = false;
      return false;
    },

    // /**
    //  * Check if Model has sites relationships
    //  * @returns {Boolean}
    //  */
    // hasSite: function() {
    //   const relationships = propOr([], 'relationships', this)
    //   if (relationships.length > 0) {
    //     const idx = this.relationships.findIndex(
    //       rel => rel.displayName === 'Site'
    //     )
    //     return idx >= 0
    //   }
    //   return false
    // },

    /**
     * Check if Concept has Relationships
     * @returns {Boolean}
     */
    hasRelationships: function () {
      return this.relationships.length > 0;
    },

    /**
     * Compute properties
     * @returns {Array}
     */
    properties: function () {
      const values = propOr([], "values", this.instance);
      return Array.isArray(values) ? values : [];
    },

    /**
     * Compute instance name from first property
     * @returns {String}
     */
    conceptTitle: {
      get: function () {
        return find(propEq("conceptTitle", true), this.instance.values);
      },

      set: function (newValue) {
        if (this.instance.values.length) {
          let conceptTitle = find(
            propEq("conceptTitle", true),
            this.instance.values
          );
          if (conceptTitle) {
            conceptTitle = newValue;
          }
        }
      },
    },

    /**
     * Compute breadcrumb text based on last route
     * @returns {String}
     */
    breadcrumb: function () {
      const lastRouteName = propOr("", "name", this.lastRoute);
      let type = prop("displayName", this.model);
      // Conditional logic for files
      if (this.isFile) {
        type = "Files";
      }
      if (Boolean(type) === false) {
        type = "Back to Search";
      }

      return lastRouteName === "dataset-records" ? "Back to Search" : type;
    },

    /**
     * Detect if the model is a file
     * @returns {Boolean}
     */
    isFile: function () {
      const id = pathOr("", ["params", "fileId"], this.$route);
      return id.indexOf("package") >= 0;
    },

    /**
     * Model URL
     * @returns {String}
     */
    modelUrl: function () {
      const datasetId = pathOr("", ["params", "datasetId"], this.$route);
      const modelId = pathOr("", ["params", "conceptId"], this.$route);
      return `${this.config.conceptsUrl}/datasets/${datasetId}/concepts/${modelId}`;

    },

    getRecordFileRelationshipsUrl: function () {
      const datasetId = this.$route.params.datasetId;
      const modelId = this.$route.params.conceptId;
      const recordId = this.$route.params.instanceId;

      return `${this.config.conceptsUrl}/datasets/${datasetId}/concepts/${modelId}/instances/${recordId}/files-paged`;
    },

    /**
     * GET url for relationships and corresponding counts
     */
    relationshipCountsUrl: function () {
      return `${this.config.conceptsUrl}/datasets/${this.datasetId}/proxy/package/external/${this.fileId}/relationCounts`;
    },

    /**
     * Compute relationships list without the files relationship
     * @returns {Array}
     */
    relationshipsModels: function () {
      return reject(propEq("name", "package"), this.relationships);
    },

    fileRelationship: function () {
      const fileIndex = this.relationships.findIndex(
        (rel) => rel.name === "package"
      );
      if (fileIndex === 0) {
        return this.relationships[fileIndex];
      }
      return {};
    },

    relationshipsUrl: function () {
      const datasetId = pathOr("", ["params", "datasetId"], this.$route);
      if (datasetId) {
        return `${this.config.conceptsUrl}/datasets/${datasetId}/relationships`;
      }
      return "";
    },

    /**
     * Computed property to generate API Url for Process File API
     * @returns {String}
     */
    processFileUrl: async function () {
      return useGetToken().then(token => {
        const packageId = this.fileId;
        return `${this.config.apiUrl}/packages/${packageId}/process?api_key=${token}`
      })
    },

    /**
     * Compute list items for the Add Relationship dropdown menu
     * @return {Array}
     */
    relationshipSelectItems: function () {
      if (this.concepts) {
        return this.concepts.filter((concept) => concept.count > 0);
      }
      return [];
    },

    /**
     * Compute proxyRecord file type
     * @returns {String}
     */
    fileType: function () {
      const packageType = pathOr(
        "",
        ["content", "packageType"],
        this.proxyRecord
      );

      if (packageType === "Collection") {
        return "Folder";
      }

      if (packageType === "ExternalFile") {
        return "External File";
      }

      const subtype = this.getFilePropertyVal(
        this.proxyRecord.properties,
        "subtype"
      );
      return subtype ? subtype : propOr("Unknown", "subtype", this.proxyRecord);
    },

    /**
     * Checks if MS Office File
     * @returns {Boolean}
     */
    isMSOfficeFile: function () {
      return (
        this.fileType === "MS Word" ||
        this.fileType === "MS Powerpoint" ||
        this.fileType === "MS Excel"
      );
    },

    // /**
    //  * Compute proxyRecord file ID
    //  * @returns {String}
    //  */
    // fileId: function() {
    //   return pathOr('', ['content', 'id'], this.proxyRecord)
    // },

    /**
     * Compute proxyRecord file location
     * @returns {Object}
     */
    fileLocation: function () {
      const ancestors = propOr([], "ancestors", this.proxyRecord);

      const path = compose(
        join("/"),
        prepend("Files"),
        map((ancestor) => {
          return ancestor.content.name;
        })
      )(ancestors);

      const route = this.proxyRecord.parent
        ? {
            name: "collection-files",
            params: {
              fileId: pathOr("", ["parent", "content", "id"], this.proxyRecord),
            },
          }
        : {
            name: "dataset-files",
          };

      return {
        path,
        route,
      };
    },

    /**
     * Compute proxyRecord file size
     * @returns {String}
     */
    fileSize: function () {
      return this.formatMetric(this.proxyRecord.storage);
    },

    /**
     * Compute relationship types url
     * @returns {String}
     */
    relationshipTypesUrl: function () {
      const datasetId = pathOr("", ["params", "datasetId"], this.$route);
      const conceptsUrl = propOr("", "conceptsUrl", this.config);

      if (conceptsUrl && datasetId) {
        return `${conceptsUrl}/datasets/${datasetId}/relationships`;
      }
      return "";
    },

    // /**
    //  * Compute if concepts and relationships have loaded
    //  * @returns {Boolean}
    //  */
    // hasConceptsAndRelationships: function() {
    //   return this.concepts.length > 0 && !this.isRelationshipsLoading
    // },

    /**
     * Compute options to display in the link to record menu
     * @returns {Array}
     */
    linkRecordOptions: function () {
      return this.isFile ? this.concepts : this.relationships;
    },

    /**
     * Compute name for original record in the add relationships drawer
     * @returns {String}
     */
    drawerOriginatingName: function () {
      const val = this.isFile
        ? pathOr("", ["content", "name"], this.proxyRecord)
        : this.$sanitize(this.formattedConceptTitle);
      return val !== undefined ? val.toString() : val;
    },


    /**
     * Linked Properties URL
     * @returns {String}
     */
    linkedPropertiesUrl: function () {

      const datasetId = pathOr("", ["params", "datasetId"], this.$route);
      const modelId = pathOr("", ["params", "conceptId"], this.$route);
      const instanceId = pathOr("", ["params", "instanceId"], this.$route);

      if (instanceId === "new") {
        return;
      }

      return `${this.config.conceptsUrl}/datasets/${datasetId}/concepts/${modelId}/instances/${instanceId}/linked`;
    },

    /**
     * compute the url to fetch the valid string subtypes
     * @returns {String}
     */
    stringSubtypeUrl: async function () {
      return await useGetToken().then(token => {
        return `${this.config.apiUrl}/models/datasets/${this.datasetId}/properties/strings?api_key=${token}`;
      })


    },
  },

  watch: {
    packageDetailsUrl: {
      handler: function (val) {
        if (val) {
          this.getInstanceDetails();
        }
      },
      immediate: true,
    },

    /**
     * Watcher for sources API URL to call
     * API for the source files table
     */
    sourceFilesUrl: {
      handler: function (val) {
        const packageId = this.fileId;
        if (val && packageId !== "") {
          this.getSourceFiles();
        }
      },
      immediate: true,
    },

    "$route.params.instanceId": {
      handler: function (val) {
        this.$nextTick(function () {
          this.$refs.bfStage.scrollToTop();
        });
      },
      immediate: true,
    },

    relationshipCountsUrl: {
      handler: function (val) {
        const newRoute = this.$route.path.indexOf("/new") > 0;
        if (val && !newRoute) {
          this.relationships = [];
          this.getRelationshipCounts();
        }
      },
      immediate: true,
    },

    hasConceptsAndRelationships: {
      handler: function (val) {
        if (val) {
          this.getRelationshipTypes();
        }
      },
      immediate: true,
    },

    properties: {
      handler: function (val) {
        const name = this.$route.query.name;
        if (val.length > 0 && name && this.getPermission("editor")) {
          /**
           * Hello there.  Are you wondering why we call $router.replace here?
           * Without it, the following happens:
           * 1. We route to the page with query.name set to some field, let's say "foo".
           *        (this happens when clicking "Add a Value" when a Model Title is blank in the Record list)
           * 2. this watcher fires, setting editing to true and focusing the "foo" field
           * 3. We update "foo" and save our changes
           *        which sets editing to false and returns us to display mode
           *        which updates `this.instance.values` accordingly
           * 4. `this.instance.values` causes computed `this.properties` to change
           * 5. this watcher fires again, and even though we have just set editing to false, it gets set to true again
           * 6. and thus we have an endless loop : (
           *
           * Clearing the `name` query parameter once we have handled it here prevents the endless loop for occurring.
           */
          this.$router.replace({
            query: { ...this.$route.query, name: undefined },
          });
          this.enableEditFocus(name);
        }
      },
      immediate: true,
    },

    // conceptsHash: {
    //   handler: function(val) {
    //     if (val && !isEmpty(val)) {
    //       this.getSchemaLinkedProperties().then(this.getLinkedProperties)
    //     }
    //   },
    //   immediate: true
    // },

    stringSubtypeUrl: {
      handler() {
        if (this.stringSubtypeUrl) {
          this.fetchStringSubtypes();
        }
      },
      immediate: true,
    },
  },

  mounted: function () {
    // Listen for property value changes
    EventBus.$on("instance-value-changed", this.onValueChanged);

    // Listen for property value errors
    EventBus.$on("instance-value-error", this.onValueError);

    // Fetch new data for a given table
    EventBus.$on("refresh-table-data", this.refreshTableData);

    // Open proper drawer component
    EventBus.$on("add-relationship", this.handleAddRelationship);

    // Update the relationships state
    EventBus.$on("update-relationships-list", this.updateRelationshipsList);

    // Check if user has seen relationships empty state info
    const hasSeenRelationshipsInfo = localStorage.getItem(
      "seen-relationships-info"
    );
    if (hasSeenRelationshipsInfo === "true") {
      this.hasSeenRelationshipsInfo = true;
    }

    EventBus.$on("update-external-file", this.onExternalFileUpdate);

    // In FileDetails window, the tool for viewing should be limited/set to PAN for panning the image/timeseries etc.
    this.setActiveTool(viewerToolTypes.PAN);
  },

  beforeUnmount() {
    EventBus.$off("instance-value-changed", this.onValueChanged);
    EventBus.$off("instance-value-error", this.onValueError);
    EventBus.$off("refresh-table-data", this.refreshTableData);
    EventBus.$off("add-relationship", this.handleAddRelationship);
    EventBus.$off("update-relationships-list", this.updateRelationshipsList);
    EventBus.$off("update-external-file", this.onExternalFileUpdate);
  },

  methods: {
    ...mapActions([
      "updateEditingInstance",
      "updateConcepts",
    ]),

    ...mapActions("filesModule", ["openOffice365File"]),

    ...mapActions("viewerModule", ["setActiveViewer", "setActiveTool"]),

    /**
     * retrieves the string subtype configuration used to populate the AddEditPropertyDialog
     */
    fetchStringSubtypes: function () {

      this.stringSubtypeUrl.then((url)=> {
        useSendXhr(url)
          .then((subTypes) => {
          this.stringSubtypes = Object.entries(subTypes).reduce(
            (options, [val, config]) => [
              ...options,
              { value: val, label: config.label, regex: config.regex },
            ],
            []
          );
        })
          .catch((response) => {
            this.handleXhrError(response);
          });
      })

    },

    /**
     * Open office 365 file
     */
    openMSOfficeFile: function () {
      this.openOffice365File(this.proxyRecord);
    },

    /**
     * Exports file as NWB type
     * @param {String} command
     */

    exportFile: function (command) {
      const payload = {
        fileType: command,
      };

      this.exportFileUrl.then(url => {
        this.sendXhr(url, {
          method: "PUT",
          header: {
          },
          body: payload,
        })
          .then((response) => {
            const fileName = pathOr("", ["content", "name"], response);
            const filePath = propOr("", "path", this.fileLocation.route);
            EventBus.$emit("toast", {
              detail: {
                type: "success",
                msg: `Copy of ${fileName} has been saved to <a href="${filePath}">${this.fileLocation.path}</a>`,
              },
            });
          })
          .catch(this.handleXhrError.bind(this));
      })


    },

    /**
     * XHR request to process a file
     * of an unprocessed state
     */
    processFile: function () {
      this.processFileUrl.then(url => {
        this.sendXhr(url, {
          method: "PUT",
        })
          .then(() => {
            this.proxyRecord.content.state = "PROCESSING";
            this.getFileStatus;
          })
          .catch(this.handleXhrError.bind(this));
      })
    },

    /**
     * API call to get source files data for table
     */
    getSourceFiles: function () {
      this.packageFilesUrl.then(url => {
        this.sendXhr(url)
          .then((response) => {
            this.packageSourceFiles = response.results;
          })
          .catch(this.handleXhrError.bind(this));
      })

    },

    // showMove: function() {
    //   const moveDialog = this.$refs.moveDialog
    //   moveDialog.file = this.file
    //   moveDialog.visible = true
    // },

    /**
     * Determines if destination record exists and user can add relationship
     * @param {String} modelName
     * @returns {Boolean}
     */
    canAddRelationship(modelName) {
      const model = find(propEq("name", modelName), this.concepts);
      const modelCount = propOr(0, "count", model);
      return modelCount > 0;
    },

    /**
     * Request relationship types
     */
    getRelationshipTypes: function () {
      if (this.relationshipsUrl) {

        useGetToken()
          .then(token => {
            return useSendXhr(this.relationshipsUrl,{
              header: {
                Authorization: `bearer ${token}`,
              }
            })
          })
          .then((response) => {
          // get model id
          const modelId = pathOr("", ["params", "conceptId"], this.$route);

          // check to see which relationship types are related to the current record id
          const relatedRelationshipTypes = response.filter((relType) =>
            Boolean(relType.from === modelId || relType.to === modelId)
          );

          // format objects for relationships state (relationship count pill buttons) and relationshipTypes state
          const relationships = relatedRelationshipTypes.map((relType) => {
            const { to, from } = relType;
            const isFrom = Boolean(from === modelId);
            const relModelId = isFrom ? to : from;
            const { displayName, name, id } = this.getModelById(relModelId);

            // update relationship types state, adding modelName and modelId to DTO
            this.relationshipTypes.push({
              ...relType,
              modelName: name,
              modelId: id,
            });

            // return relationship count object
            return { count: 0, displayName, name };
          });

          // update relationships state
          this.relationships = uniqBy(prop("displayName"), [
            ...this.relationships,
            ...relationships,
          ]);

          // update active sections state
          const relationshipNames = pluck("name", this.relationships);
          this.activeSections = uniq([
            ...this.activeSections,
            ...relationshipNames,
          ]);
        });
      }
    },

    /**
     * Compute relationship name tooltip
     * @returns {Object}
     */
    relationshipNameTooltip: function (name) {
      if (name.length > 20) {
        return {
          content: name,
        };
      }
      return {};
    },

    /**
     * Tracks property values that are of type arrays
     * @param  {Object} obj
     */
    handleAddPropertyValue: function (obj) {
      const updatedArrayValues = Object.assign({}, this.arrayValues, obj);
      this.arrayValues = updatedArrayValues;
    },

    /**
     * Increments property count for concept in state
     * @param {Number} count
     */
    incrementPropertyCount: function (count) {
      const id = pathOr("", ["params", "conceptId"], this.$route);
      const updatedConcepts = this.concepts.map((concept) => {
        if (concept.id === id) {
          concept.propertyCount = count;
        }
        return concept;
      });
      this.updateConcepts(updatedConcepts);
    },

    /**
     * Open file relationship drawer
     */
    handleChooseExistingFiles: function () {
      this.$refs.addFileRelationshipDrawer.openDrawer(this.model.id);
    },

    /**
     * Reset instance when user confirms loss of changes
     */
    onConfirmLossOfChanges: function () {
      this.resetInstance();
    },

    /**
     * Gets relationships and corresponding counts
     */
    getRelationshipCounts: function () {
      const url = this.relationshipCountsUrl;

      if (!url) {
        return;
      }

      this.isRelationshipsLoading = true;

      useGetToken()
        .then(token => {
          useSendXhr(url, {
            header: {
              Authorization: `bearer ${token}`,
            },
          })
            .then((resp) => {
              resp.forEach((obj) => {
                this.activeSections.push(obj.name);
              });
              const filesIdx = findIndex(propEq("name", "package"), resp);
              if (filesIdx >= 0) {
                const filesObj = resp[filesIdx];
                resp.splice(filesIdx, 1);
                resp.unshift(filesObj);
                this.relationships = resp;
              } else {
                this.relationships = resp;
              }
              if (this.relationships.count !== this.lastRelationshipCount) {
                this.relationships.count = this.lastRelationshipCount;
              }

              this.isRelationshipsLoading = false;
            })
            .catch(() => {
              this.handleXhrError.bind(this);
            });
        })

    },
    /**
     * Gets instance details
     */
    getInstanceDetails: function () {

      this.packageDetailsUrl.then(url => {
        return this.sendXhr(url, {
        })
          .then((resp) => {
            if (this.isFile) {
              this.setProxyAsRecord(resp);
            } else {
              this.instance = resp;
            }
          })
          .catch(this.handleXhrError.bind(this));
      })

    },

    /**
     * Handle table refresh events
     * @param {Object} data
     */
    refreshTableData: function (data) {
      const relName = propOr("", "name", data);
      const count = propOr(0, "count", data);
      const type = propOr("", "type", data);

      let table;
      if (relName === "package") {
        table = propOr(null, "package", this.$refs);
      } else {
        table = pathOr(null, [relName, 0])(this.$refs);
      }
      const relIdx = this.getRelationshipIdx(relName, table);

      // Add new table if relationship doesn't exist
      if (relIdx < 0) {
        this.addTable(relName, data);
        return;
      }

      const relationship = this.relationships[relIdx];
      if (type === "Remove") {
        this.handleTableRemoveUpdate(table, count, relationship, relIdx);
      } else if (type === "Add") {
        this.handleTableAddUpdate(table, count, relationship);
      }
    },

    /**
     * Get a relationship index given a relationship name
     * @param {String} relName
     * @param {Object} table
     */
    getRelationshipIdx: function (relName, table) {
      if (relName === "package" && !table) {
        return -1;
      } else if (relName === "package" && table) {
        return 0;
      }
      return this.relationships.findIndex((rel) => rel.name === relName);
    },

    /**
     * Add a new table to the dom by updating the relationships state
     * @param {String} relName
     * @param {Object} data
     */
    addTable: function (relName, data) {
      this.activeSections.push(relName);

      if (relName !== "package") {
        this.relationships.push(data);
      } else {
        this.relationships.unshift(data);
      }
    },

    /**
     * Remove items from a given table and update relationships list state
     * @param {Object} table
     * @param {Number} count
     * @param {Object} relationship
     */
    handleTableRemoveUpdate: function (table, count, relationship) {
      if (table && relationship) {
        table.selection = [];
        relationship.count -= count;
        this.lastRelationshipCount = relationship.count;
        const state = "Deleted File";
        table.refreshTable();
      }
    },

    /**
     * Add items to a given table and update relationships list state
     * @param {Object} table
     * @param {Number} count
     * @param {Object} relationship
     */
    handleTableAddUpdate: function (table, count, relationship) {
      if (table && relationship) {
        relationship.count += count;
        table.refreshTable();
      }
    },

    /**
     * Open remove relationships confirmation window
     * @param {Object} data
     */
    handleRemoveRelationships: function (data) {
      const ref = this.$refs.removeRelDialog;
      ref.tableName = data.tableName;
      ref.relationships = data.relationships;
      ref.datasetId = this.dataset.content.id;
      ref.dialogVisible = true;
    },

    /**
     * Open remove relationships confirmation window
     * @param {Object} data
     */
    handleUnlinkFiles: function (data) {
      this.isUnlinkFileDialogVisible = true;
      this.unlinkFileData = {
        tableName: data.tableName,
        relationships: data.relationships,
        datasetId: this.dataset.content.id,
      };
    },

    /**
     * Sets related files
     * @param {Array} data
     */
    handleSetRelatedFiles: function (data) {
      this.relatedFiles = data;
    },

    /**
     * Update relationships state after user creates new relationships
     * @param {Array} relationships
     */
    updateRelationshipsList: function (relationships) {
      relationships.forEach((relationship) => {
        this.relationships.push(relationship);
      });
    },
    /**
     * Handles add relationship events
     * @param {String} conceptName
     */
    handleAddRelationship: function (conceptName) {
      const idx = this.concepts.findIndex((c) => c.name === conceptName);
      const conceptId = pathOr("", [idx, "id"])(this.concepts);
      if (conceptId) {
        this.$refs.addRelationshipDrawer.openDrawer(conceptId);
      } else if (conceptName === "package") {
        this.$refs.addFileRelationshipDrawer.openDrawer(this.model.id);
      }
    },
    /**
     * Handles link record menu selections for adding relationships
     * @param {String} command
     */
    onLinkRecordMenuClick: function (command) {
      if (command === "files") {
        this.$refs.addFileRelationshipDrawer.openDrawer(this.model.id);
      } else {
        this.$refs.addRelationshipDrawer.openDrawer(command);
      }
    },

    /**
     * Get the arrow direction based on section name and if it is active
     * @param {string} sectionName
     * @returns {string}
     */
    arrowDirection: function (sectionName) {
      const isActive = contains(sectionName, this.activeSections);
      return isActive ? "down" : "right";
    },

    /**
     * Enable edit mode
     */
    enableEdit: function () {
      this.updateEditingInstance(true);
      this.originalProperties = clone(this.instance.values);
    },

    /**
     * Enable edit mode and focus on the property
     * @param {String} name
     */
    enableEditFocus: function (name) {
      this.enableEdit();

      // Focus on the input
      this.$nextTick(function () {
        const input = this.$el.querySelector(`#input-${name}`);
        if (input) {
          input.focus();
        }
      });
    },
    /**
     * Dismiss files empty state info
     */
    dismissFilesInfo: function () {
      this.hasSeenUploadInfo = true;
      localStorage.setItem("seen-upload-info", true);
    },
    /**
     * Dismiss relationships empty state info
     */
    dismissRelationshipsInfo: function () {
      this.hasSeenRelationshipsInfo = true;
      localStorage.setItem("seen-relationships-info", true);
    },
    /**
     * On drop, send files to BfUpload
     * @param {Object} evt
     */
    onDrop: function (evt) {
      EventBus.$emit("add-to-upload-queue", { dataTransfer: evt.dataTransfer });
      this.$store.dispatch("updateUploadDestination", {
        content: this.dataset.content,
      });
      this.isDraggingFiles = false;

      // Check for belongs_to relationship type in dataset
      this.checkForDefaultRelationship();
    },
    /**
     * Trigger input file click
     */
    triggerInputFile: function () {
      this.$refs.inputFile.click();
    },
    /**
     * Callback when file input has changed
     * @param {Object} Event
     */
    onInputFileChange: function (e) {
      EventBus.$emit("add-input-files-to-upload-queue", e);
      this.$store.dispatch("updateUploadDestination", {
        content: this.dataset.content,
      });

      // Reset file input
      this.$refs.inputFile.value = "";

      // Check for belongs_to relationship type in dataset
      this.checkForDefaultRelationship();
    },
    /**
     * Open Bf Uploader
     */
    openUploader: function () {
      EventBus.$emit("open-uploader", true);
      this.$store.dispatch("updateUploadDestination", {
        content: this.dataset.content,
      });
    },
    /**
     * Set is dragging property if the user is adding files
     * @param {Boolean} isDragging
     */
    setIsDragging: function (isDragging) {
      if (this.isAddingFiles) {
        this.isDraggingFiles = isDragging;
      }
    },
    /**
     * Reset the instance back to original state
     */
    resetInstance: function () {
      this.updateEditingInstance(false);
      this.changedProperties = [];
      this.errorProperties = [];
      this.instance.values = clone(this.originalProperties);
      this.originalProperties = [];
    },

    /**
     * Listen for value changes and modify the list that keeps track of changes
     * @param {Object} prop
     */
    onValueChanged: function (prop) {
      if (prop.changed) {
        this.changedProperties.push(prop.name);
      } else {
        const index = this.changedProperties.indexOf(prop.name);
        if (index >= 0) {
          this.changedProperties.splice(index, 1);
        }
      }
    },

    /**
     * Listen for value errors and modify the list that keeps track of errors
     * @param {Object} prop
     */
    onValueError: function (prop) {
      if (prop.error) {
        this.errorProperties.push(prop.name);
      } else {
        const index = this.errorProperties.indexOf(prop.name);
        if (index >= 0) {
          this.errorProperties.splice(index, 1);
        }
      }
    },

    /**
     * Send record to the API to be created
     */
    createRecord: async function () {
      const allRequiredFieldsValid = this.validateRequiredFields();

      if (this.errorProperties.length === 0 && allRequiredFieldsValid) {
        this.savingChanges = true;

        const datasetId = this.$route.params.datasetId;
        const conceptId = this.$route.params.conceptId;
        const url = `${this.config.conceptsUrl}/datasets/${datasetId}/concepts/${conceptId}/instances`;

        const values = this.formatSavedValues();

        try {
          // Make request to create new instance
          useGetToken().then(token => {
            this.sendXhr(url, {
              header: {
                Authorization: `bearer ${token}`,
              },
              method: "POST",
              body: {
                values,
              },
            }).then(async response => {
              const batchUrl = `${url}/${record.id}/linked/batch`;
              await this.createBatchLinkedProperties(
                batchUrl,
                this.linkedProperties
              );

              // Redirect user to new concept instance page
              this.$router.replace({
                name: "metadata-record",
                params: {
                  instanceId: record.id,
                },
              });

              // Update count for model
              const index = findIndex(
                propEq("name", this.model.name),
                this.concepts
              );

              const updatedConcepts = this.concepts.slice();
              updatedConcepts[index].count++;

              this.updateConcepts(updatedConcepts).then(() => {
                this.savingChanges = false;
                this.updateEditingInstance(false);
                this.changedProperties = [];
                this.errorProperties = [];
              });
            })
          })
        } catch (e) {
          this.processing = false;
          this.savingChanges = false;
          this.handleXhrError(e);
        }
      }
    },

    createBatchLinkedProperties: function (url, linkedProperties) {
      /**
       * Remove all empty linked properties, and then transform
       * the shape to match the endpoint's body
       */
      const properties = linkedProperties
        .filter((property) => {
          return property.to.recordId !== "";
        })
        .map((property) => {
          return {
            name: property.schemaLinkedProperty.name,
            schemaLinkedPropertyId: property.schemaLinkedProperty.id,
            to: property.to.recordId,
          };
        });

      return useGetToken().then(token => {
        return this.sendXhr(url, {
          header: {
            Authorization: `bearer ${token}`,
          },
          method: "POST",
          body: {
            data: properties,
          },
        });
      })

    },

    /**
     * Formats numbers based on property's data type
     * @param {String} dataType
     * @param {Object} val
     * @returns {Object|Number}
     */
    formatNumber: (dataType) => (val) =>
      dataType === "Long" || dataType === "Double"
        ? val == "" || val == null
          ? null
          : Number(val)
        : val,

    /**
     * Formats property array values
     * @param {String} name
     * @param {String} dataType
     * @returns {Array|undefined}
     */
    formatArrayValues: function (name, dataType) {
      const values = this.arrayValues[name];
      if (!values) {
        return;
      }
      const formatter = this.formatNumber(dataType);
      const formattedValues = values.map(formatter).filter(Boolean);
      const uniqValues = flatten(uniq(formattedValues));
      return uniqValues.length > 0 ? uniqValues : null;
    },

    /**
     * Formats saved values based on data type
     * @returns {Array}
     */
    formatSavedValues: function () {
      const instanceValues = propOr([], "values", this.instance);
      const values = instanceValues.map((val) => {
        const name = val.name;
        const propValue = val.value;
        const dataType = this.getRawDataType(val);
        const formattedValue = this.formatNumber(dataType)(propValue);
        const arrayValue = this.formatArrayValues(name, dataType);
        const value = defaultTo(formattedValue, arrayValue);
        // update the instance values to refresh the rendered values
        val.value = value;
        return { value, name };
      });
      return values;
    },

    /**
     * Validates if all required fields have been entered
     * @returns {Boolean}
     */
    validateRequiredFields: function () {
      const nullVals = this.properties.filter((obj) => {
        const isArray = pathEq(["dataType", "type"], "array", obj);
        return (
          (isEmpty(obj.value) || isNil(obj.value)) &&
          (obj.required || obj.conceptTitle) &&
          !isArray
        );
      });
      const arrayNullVals = Object.keys(this.arrayValues).filter((key) => {
        const prop = find(propEq("name", key), this.properties);
        const isRequired = propOr(false, "required", prop);
        const containsNull = !head(this.arrayValues[key]);
        if (isRequired && containsNull) {
          return prop;
        }
      });
      if (nullVals.length > 0 || arrayNullVals.length > 0) {
        // emit toast
        EventBus.$emit("toast", {
          detail: {
            type: "error",
            msg: "Please make sure all required fields have been entered",
          },
        });
        return false;
      }
      return true;
    },

    /**
     * Save property changes
     */
    saveChanges: function () {
      const allFieldsRequired = this.validateRequiredFields();

      if (this.errorProperties.length === 0 && allFieldsRequired) {
        this.savingChanges = true;
        const url = this.packageDetailsUrl;
        const values = this.formatSavedValues();

        useGetToken().then(token => {
          this.sendXhr(url, {
            header: {
              Authorization: `bearer ${token}`,
            },
            method: "PUT",
            body: {
              values,
            },
          })
            .then((resp) => {
              this.savingChanges = false;
              this.updateEditingInstance(false);
              this.changedProperties = [];
              this.errorProperties = [];

              const values = propOr([], "values", resp);
              this.instance.values = values;
              EventBus.$emit("toast", {
                detail: {
                  type: "success",
                  msg: `${this.$sanitize(this.formattedConceptTitle)} updated`,
                },
              });

              EventBus.$emit("track-event", {
                name: "Record Saved",
              });
            })
            .catch((err) => {
              this.processing = false;
              this.savingChanges = false;
              this.handleXhrError(err);
            });
        })

      }
    },

    /**
     * Listener for rafter overflow menu click
     * @param {String} command
     */
    onOverflowMenuClick: function (command) {
      const commands = {
        archive: this.showArchiveDialog,
        addProperty: this.openAddProperty,
        "rename-file": this.showRenameFileDialog,
        "edit-file": this.showEditFileDialog,
        "move-file": this.showMove,
        "delete-file": this.showDeleteDialog,
      };

      const handler = commands[command];

      if (typeof handler === "function") handler();
    },

    /**
     * Show edit file dialog
     */
    showEditFileDialog: function () {
      EventBus.$emit("open-external-file-modal", this.proxyRecord);
    },

    /**
     * Show archive dialog
     */
    showArchiveDialog: function () {
      this.archiveDialogVisible = true;
    },

    /**
     * Show rename file dialog
     */
    showRenameFileDialog: function () {
      EventBus.$emit("rename-file", this.proxyRecord);
    },

    /**
     * Show delete dialog
     */
    showDeleteDialog: function () {
      this.$refs.deleteFilesDialog.visible = true;
    },

    /**
     * Archive instance
     */
    archiveRecord: function () {
      const name = propOr("", "value", this.conceptTitle);


      useGetToken()
        .then(token => {
          useSendXhr(this.packageDetailsUrl, {
            header: {
              Authorization: `bearer ${token}`,
            },
            method: "DELETE",
          })
            .then(() => {
              this.$router.replace({ name: "dataset-records" });

              EventBus.$emit("toast", {
                detail: {
                  type: "success",
                  msg: `${name} deleted`,
                },
              });
            })
            .catch((response) => {
              this.handleXhrError(response);
            });
        })

    },

    /**
     * Open the add property dialog
     */
    openAddProperty: function () {
      this.addEditPropertyDialogVisible = true;
    },

    /**
     * Add property to current instance
     * @param {Object} property
     */
    onAddPropertyConfirm: function (property) {
      // Get model's schema
      if (this.schema.length === 0) {
        this.getModelSchema()
          .then((response) => {
            this.schema = response;
            this.addProperty(property);
            // increment property count
            this.incrementPropertyCount(response.length + 1);
          })
          .catch((response) => {
            this.handleXhrError(response);
          });
      } else {
        this.addProperty(property);
        // increment property count
        const incr = this.model.propertyCount + 1;
        this.incrementPropertyCount(incr);
      }
    },

    /**
     * Send add property request to API
     * @param {Object} property
     */
    addProperty: function (property) {
      // Check if property is a modelTitle
      let properties = clone(this.schema);
      properties = this.checkModelTitle(property, properties);
      properties.push(property);

      useGetToken()
        .then(token => {
          useSendXhr(this.getModelSchemaUrl, {
            header: {
              Authorization: `bearer ${token}`,
            },
            method: "PUT",
            body: properties,
          })
            .then(() => {
              // Check model title for existing properties before adding new one
              this.checkModelTitle(property, this.instance.values);

              this.instance.values.push(property);

              this.addEditPropertyDialogVisible = false;
            })
            .catch((response) => {
              this.handleXhrError(response);
            });
        })

    },

    /**
     * Check if new property is the model title, and unset the old one
     * @param {Object} property
     * @param {Array} list
     */
    checkModelTitle(property, list) {
      if (property.conceptTitle) {
        const curModelTitle = find(propEq("conceptTitle", true), list);
        curModelTitle.conceptTitle = false;
      }

      return list;
    },

    /**
     * Get model schema from API
     */
    getModelSchema: function () {
      useGetToken()
        .then(token => {
          return useSendXhr(this.getModelSchemaUrl, {
            header: {
              Authorization: `bearer ${token}`,
            },
          });
        })

    },

    /**
     * Get schema and setup state to create a record with that schema
     */
    setupCreateRecord: function () {
      this.isRecordsLoading = true;
      if (this.getModelSchemaUrl) {
        this.linkedProperties = [];
        this.relationships = [];

        this.resetInstance();

        this.getModelSchema()
          .then((response) => {
            this.schema = response;
            this.instance = {
              values: response,
            };

            // Focus on the model title input
            const modelTitleName = propOr("", "name", this.conceptTitle);
            this.enableEditFocus(modelTitleName);
            this.isRecordsLoading = false;
          })
          .catch((response) => {
            this.handleXhrError(response);
            this.isRecordsLoading = false;
          });

        this.getSchemaLinkedProperties();
      }
    },

    /**
     * Transform properties into flat list and convert shape
     * @param {Array} list
     * @returns {Array}
     */
    getProperties: compose(
      map((obj) => {
        return {
          conceptTitle: false,
          dataType: obj["dataType"],
          default: true,
          displayName: obj["key"],
          locked: false,
          name: obj["key"],
          value: obj["value"],
        };
      }),
      flatten(),
      pluck("properties")
    ),

    /**
     * Set proxy as record, and transform properties
     * @param {Object} response
     */
    setProxyAsRecord: function (response) {
      // Set the proxyRecord
      this.proxyRecord = response;

      // Set Active Viewer
      console.log('Setting active viewer')
      console.log(this.proxyRecord)
      this.setActiveViewer(this.proxyRecord);

      this.selectedFiles.push(response);
    },

    /**
     * Open viewer if the file is ready
     */
    openViewer: function () {
      this.$router.replace({
        name: "viewer",
        params: {
          fileId: `${this.fileId}`,
        },
      });
    },

    /**
     * GET url for record relationships tables
     */
    getRecordRelationshipsUrl: function (conceptName) {
      const datasetId = this.datasetId;
      const fileId = this.$route.params.fileId;

      return `${this.config.conceptsUrl}/datasets/${datasetId}/proxy/package/external/${fileId}/relations/${conceptName}/files`;
    },

    breadcrumbNavigate: function () {
      const lastRouteName = propOr("", "name", this.lastRoute);
      let route = { name: "model-details" };

      if (
        lastRouteName === "dataset-files" ||
        lastRouteName === "collection-files"
      ) {
        route = pick(["name", "params"], this.lastRoute);
      }

      this.$router.push(route);
    },

    /**
     * Check if a belongs_to relationship type exists in the current dataset
     */
    checkForDefaultRelationship: function () {
      // check if belongs_to relationship exists in dataset
      const url = this.relationshipsUrl;
      if (url) {
        useGetToken()
          .then(token => {
            useSendXhr(url, {
              header: {
                Authorization: `bearer ${token}`,
              },
            })
              .then((resp) => {
                const belongsTo = find(propEq("name", "belongs_to"), resp);
                if (resp.length === 0 || !belongsTo) {
                  this.createDefaultRelationship();
                }
              })
              .catch(this.handleXhrError.bind(this));
          })

      }
    },

    /**
     * Creates default relationship
     */
    createDefaultRelationship: function () {
      useGetToken()
        .then(token => {
          useSendXhr(this.relationshipsUrl, {
            method: "POST",
            header: {
              Authorization: `bearer ${token}`,
            },
            body: {
              name: "belongs_to",
              displayName: "Belongs To",
              description: "",
              schema: [],
            },
          }).catch(this.handleXhrError.bind(this));
        })

    },

    /**
     * Handles event to open delete file dialog
     * @param {Array} selectedFiles
     */
    handleDeleteFiles: function (selectedFiles) {
      this.selectedFiles = selectedFiles;
      this.$refs.deleteFilesDialog.visible = true;
    },

    /**
     * Handler for delete files XHR
     */
    onDelete: function () {
      if (this.isFile) {
        // Take user to the location of the file on the files page
        this.$router.replace(this.fileLocation.route);
      } else {
        const payload = {
          name: "package",
          count: this.selectedFiles.length,
          type: "Remove",
        };
        this.refreshTableData(payload);
      }
    },

    /**
     * Emit download file event
     */
    downloadFile: function () {
      if (Object.keys(this.proxyRecord).length) {
        EventBus.$emit("trigger-download", [this.proxyRecord]);
      }
    },

    /**
     * Set new name
     * @param {Object} file
     */
    onFileRenamed: function (file) {
      const oldName = pathOr("", ["content", "name"], this.proxyRecord);
      this.proxyRecord.content.name = pathOr(
        oldName,
        ["content", "name"],
        file
      );
    },

    /**
     * Set new name and description for external file
     * @param {Object} file
     */
    onExternalFileUpdate: function (file) {
      const oldName = pathOr("", ["content", "name"], this.proxyRecord);
      const oldDescription = pathOr(
        "",
        ["externalFile", "description"],
        this.proxyRecord
      );
      this.proxyRecord.content.name = pathOr(
        oldName,
        ["content", "name"],
        file
      );
      this.proxyRecord.externalFile.location = pathOr(
        "",
        ["externalFile", "location"],
        file
      );
      this.proxyRecord.externalFile.description = pathOr(
        oldDescription,
        ["externalFile", "description"],
        file
      );

      EventBus.$emit("toast", {
        detail: {
          msg: "External file was updated",
          type: "success",
        },
      });
    },

    /**
     * Show move dialog after getting the parent's (or dataset's) children
     */
    showMove: function () {
      const moveDialog = this.$refs.moveDialog;

      // Get parent's children
      const parentId = pathOr(
        path(["content", "id"], this.dataset),
        ["parent", "content", "id"],
        this.proxyRecord
      );
      const baseUrl = this.proxyRecord.parent ? "packages" : "datasets";

      useGetToken()
        .then(token => {
          const url = `${this.config.apiUrl}/${baseUrl}/${parentId}?api_key=${token}&includeAncestors=true`;
          return this.sendXhr(url).then((response) => {
            moveDialog.file = response;
            moveDialog.visible = true;
          });
        }).catch(err => useHandleXhrError(err))


    },

    /**
     * Send XHR to move items
     * @param {String} destination}
     * @param {Array} items
     */
    moveItems: function (destination, items) {

      this.moveUrl.then(url => {
        const things = items.map(window.R.path(["content", "id"]));
        this.sendXhr(url, {
          method: "POST",
          body: {
            destination,
            things,
          },
        })
          .then((response) => {
            if (response.success.length > 0) {
              /*
              Get the file again to update all values of the file.
              Move response doesn't give as much info as needed
            */
              this.getInstanceDetails();

              EventBus.$emit("toast", {
                detail: {
                  type: "success",
                  msg: `File moved`,
                },
              });
            }
            if (response.failures.length > 0) {
              this.onMoveFailure(response);
            }
          })
          .catch((response) => {
            this.handleXhrError(response);
          });
      })
    },

    /**
     * Handler for failing move
     * Show name conflict UX
     * @param {Object} response
     */
    onMoveFailure: function (response) {
      const failures = propOr([], "failures", response);

      this.moveConflict = {
        display: [this.proxyRecord],
        files: failures,
        destination: propOr("", "destination", response),
      };

      // Show user notice of conflicts
      this.$refs.moveDialog.visible = true;
    },

    /**
     * Rename conflicts, and then attempt to move them again
     * @param {String} destination
     * @param {Array} files
     */
    onRenameConflicts: function (destination, files) {
      // Rename each file with proposed new name

      useGetToken().then(token =>{
        const promises = files.map((obj) => {
          const id = propOr("", "id", obj);
          const url = `${this.config.apiUrl}/packages/${id}?api_key=${token}`;

          return this.sendXhr(url, {
            method: "PUT",
            body: {
              name: propOr("", "generatedName", obj),
            },
          });
        });
        Promise.all(promises).then((response) => {
          // Update name
          this.onFileRenamed(head(response));

          // Move files again, now with new name
          this.moveItems(destination, response);

          // Reset
          this.moveConflict = {};

          // Hide user notice of conflicts
          this.$refs.moveDialog.visible = false;
        });
      })

    },

    /**
     * Transform raw linked properties data
     * @param {Array} linkedProperties
     * @returns {Array}
     */
    transformLinkedProperties: function (linkedProperties) {
      return linkedProperties.map((linkedProperty) => {
        const model = this.conceptsHash[linkedProperty.link.to];

        return {
          schemaLinkedProperty: {
            id: linkedProperty.link.id,
            name: linkedProperty.link.displayName,
            displayName: linkedProperty.link.displayName,
          },
          to: {
            modelId: model.id,
            modelDisplayName: model.displayName,
            recordId: "",
            recordDisplayName: "",
          },
        };
      });
    },

    /**
     * Get linked properties
     */
    getLinkedProperties: function () {
      if (this.linkedPropertiesUrl) {
        useGetToken().then(token => {
          this.sendXhr(this.linkedPropertiesUrl, {
            header: {
              Authorization: `bearer ${token}`,
            },
          })
            .then((response) => {
              response.forEach((linkedProperty) => {
                const idx = this.linkedProperties.findIndex((item) => {
                  return (
                    item.schemaLinkedProperty.id ===
                    linkedProperty.schemaLinkedPropertyId
                  );
                });
                const updatedLinkedProperty = this.linkedProperties[idx];
                updatedLinkedProperty.linkedPropertyId = linkedProperty.id;
                updatedLinkedProperty.to.recordId = linkedProperty.to;

                this.setLinkedPropertyDisplayName(updatedLinkedProperty, idx);
              });
            })
            .catch((response) => {
              this.handleXhrError(response);
            });
        })

      }
    },

    /**
     * Open remove linked property modal
     * @param {Object} linkedProperty
     */
    openLinkedPropertyModal: function (linkedProperty) {
      this.selectedLinkedProperty = linkedProperty;
      this.unlinkDialogVisible = true;
    },

    /**
     * Open linked property drawer
     * @param {Object} property
     */
    editLinkedProperty: function (property) {
      this.$refs.addLinkedPropertyDrawer.openDrawer(property);
    },

    /**
     * Handle remove-linked-property event
     * @param {Object} linkedProperty
     */
    onRemoveLinkedProperty: function (linkedProperty) {
      const idx = this.linkedProperties.findIndex((item) => {
        return (
          item.schemaLinkedProperty.id ===
          linkedProperty.schemaLinkedProperty.id
        );
      });
      const updatedLinkedProperty = this.linkedProperties[idx];
      updatedLinkedProperty.to.recordId = "";
      updatedLinkedProperty.to.recordDisplayName = "";

      this.linkedProperties.splice(idx, 1, updatedLinkedProperty);
    },

    /**
     * Handle update-linked-property event
     * @param {Object} linkedProperty
     */
    onUpdateLinkedProperty: function (linkedProperty) {
      const idx = this.linkedProperties.findIndex((item) => {
        return (
          item.schemaLinkedProperty.id === linkedProperty.schemaLinkedPropertyId
        );
      });
      const updatedLinkedProperty = this.linkedProperties[idx];
      updatedLinkedProperty.to.recordId = linkedProperty.to;
      updatedLinkedProperty.linkedPropertyId = linkedProperty.id;

      this.setLinkedPropertyDisplayName(updatedLinkedProperty, idx);
    },

    /**
     * Get a record
     * @param {Object} linkedProperty
     * @param {Number} index
     */
    setLinkedPropertyDisplayName: function (linkedProperty, index) {
      const datasetId = pathOr("", ["params", "datasetId"], this.$route);
      const conceptId = pathOr("", ["to", "modelId"], linkedProperty);
      const instanceId = pathOr("", ["to", "recordId"], linkedProperty);

      if (!instanceId) {
        return;
      }

      const packageDetailsUrl = `${this.config.conceptsUrl}/datasets/${datasetId}/concepts/${conceptId}/instances/${instanceId}`;

      useGetToken().then(token => {
        this.sendXhr(packageDetailsUrl, {
          header: {
            Authorization: `bearer ${token}`,
          },
        })
          .then((resp) => {
            const displayName = propOr("", "value", head(resp.values));
            linkedProperty.to.recordDisplayName = displayName;
            this.linkedProperties.splice(index, 1, linkedProperty);
          })
          .catch(this.handleXhrError.bind(this));
      })

    },

    /**
     * On remove linked property, either show the confirm
     * dialog, or remove "staged" linked property (when creating)
     * @params {Object} property
     */
    removeLinkedPropertyEditScreen: function (property) {
      this.isCreating
        ? this.onRemoveLinkedProperty(property)
        : this.openLinkedPropertyModal(property);
    },
  },
};
</script>

<style lang="scss" scoped>
@use "../../../../styles/theme";
@use "../../../../styles/_icon-item-colors";

#file-name-header {
  font-size: 20px;
  margin-left: 20px;
  align-self: flex-end;
  font-weight: 500;
}

.model-name {
  margin: 16px 0 0 0;
  color: white;
  font-weight: 300;
}

.highlight-property {
  color: theme.$gray_6;
  font-weight: 500;
}

.source-files-table {
  //display: flex;
}

.concept-instance {
  background: #fff;
  .files-section {
    padding: 0;
  }

  &.editing {
    background: theme.$gray_1;

    h2 {
      margin-bottom: 4px;
    }
  }
  .back-to-search {
    align-items: center;
    display: flex;
    .svg-icon {
      margin-right: 8px;
    }
  }
  .el-collapse-item__header,
  .el-collapse-item__header.is-active {
    background: none;
    padding: 8px;
    padding-right: 0;
    height: auto;
    .table-info {
      margin-right: 24px;
    }
    .el-collapse-item__arrow {
      display: none;
    }
  }

  .static-prop-section {
    margin-top: 8px;
  }
  .collapse-properties .el-collapse-item__wrap {
    padding-bottom: 16px;
    background: #fbfbfd;
  }

  .source-files-table-properties .el-collapse-item__wrap {
    background: #fbfbfd;
  }

  .el-collapse-item {
    .table-info,
    .table-actions {
      align-items: center;
      color: theme.$purple_1;
      display: flex;
      line-height: initial;
      font-size: 12px;
      height: 24px;
    }
    .table-info {
      .selected-files {
        color: theme.$gray_6;
        margin-right: 16px;
      }

      .selected-source-files {
        color: theme.$gray_6;
      }
    }
    &.row-is-selected {
      .el-collapse-item__header {
        background-color: #e9edf6;
      }
    }
  }
  .relationship-title {
    align-items: center;
    flex: 1;
    h2 {
      font-family: "roboto";
      color: theme.$purple_1;
      flex: 1;
      font-size: 20px;
      font-weight: 600;
      line-height: 1;
      margin: 0 0 0 8px;
    }
  }
  .el-table {
    .caret-wrapper {
      display: none;
    }
  }
  .el-table-column--selection {
    .cell {
      padding: 0;
      min-height: 25px;
      text-align: center;
    }
  }
  .remove-relationship {
    cursor: pointer;
    text-align: right;
  }
  .archive-model-warning {
    font-weight: 600;
    color: black;
  }

  .bf-button.secondary.save-button {
    height: 40px;
  }
}

#btn-show-all-props {
  display: block;
  margin: 8px 0 16px;
  text-decoration: underline;
  &:focus,
  &:hover {
    text-decoration: none;
  }
}
.concept-instance-section {
  margin-bottom: 16px;
  .collapse-properties {
    .source-files {
      background: blue !important;
    }
  }
}

.relationships-list {
  display: flex;
  flex-wrap: wrap;
  height: 100%;
  li {
    display: inline-flex;
  }
}

.source-files {
  .el-collapse-item__wrap {
    background: none;
  }
}
.files-empty-state {
  .el-collapse-item__wrap {
    background-color: rgba(233, 237, 246, 0.2);
  }
  .el-collapse-item__content {
    padding: 0;
  }
  .bf-upload-dropzone {
    background: theme.$purple_tint;
    border: 1px dashed theme.$purple_1;
    height: 214px;
    padding: 0;
  }
  .files-empty-state-inner {
    align-items: center;
    display: flex;
    height: 50px;
    justify-content: center;
  }

  .svg-icon {
    height: 24px;
    width: 24px;
  }

  .dropzone-content {
    max-width: 500px;

    a {
      color: theme.$purple_1;
    }

    p {
      max-width: 450px;
      padding: 0 16px;
      color: theme.$gray_4;

      a {
        color: theme.$purple_1;
      }
    }

    h3 {
      color: #000;
    }
  }
}

.file-list {
  padding: 0 8px;
  background: white;
  margin-bottom: 16px;
}

.property-list {
  padding: 0 16px;
  background: theme.$gray_1;
  margin-bottom: 16px;
}

.relationships-empty-state {
  background: theme.$purple_tint;
  border: 1px dashed theme.$purple_1;
  height: 214px;
  display: flex;

  &-inner {
    max-width: 460px;
    margin: 0 auto;
    text-align: center;
    padding: 8px;

    .relationship-inner-text {
      color: theme.$gray_4;
      margin-bottom: 16px;
    }

    .bf-button.learn-more {
      margin-bottom: 16px;
    }
  }
  &.site-empty-state {
    h3 {
      margin-top: 8px;
    }
  }
}

#concept-title {
  align-content: middle;
  display: flex;
  &:hover {
    button {
      display: inline-flex;
    }
  }
  button {
    color: theme.$gray_4;
    display: none;
    margin-left: 8px;
    &:hover {
      color: theme.$app-primary-color;
    }
  }
}

.file-checkbox {
  margin-right: 16px;
}

.blinded-review-heading {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
}

.viewer-pane-wrap {
  color: theme.$purple_2;
  flex: 1;
  font-size: 12px;
  font-weight: 300;
  line-height: 1;
  margin: 40px 0px 0 0px;

  .header {
    font-size: 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .viewer-pane {
    margin-top: 8px;
  }
}

.instance-type {
  color: theme.$gray_4;
  font-weight: 600;
  text-transform: capitalize;
}
</style>
