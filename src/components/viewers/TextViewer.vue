<template>
  <div class="text-viewer">
    <div class="text-viewer-toolbar" v-if="canEdit">
      <button
        v-if="!isEditing"
        class="tv-btn"
        :disabled="isReplacing"
        @click="startEdit"
      >
        Edit
      </button>
      <template v-else>
        <button
          class="tv-btn tv-btn--primary"
          :disabled="isReplacing || !isDirty"
          @click="replaceFile"
        >
          {{ isReplacing ? "Replacing…" : "Replace" }}
        </button>
        <button class="tv-btn" :disabled="isReplacing" @click="cancelEdit">
          Cancel
        </button>
      </template>
    </div>
    <div class="wrapper">
      <textarea
        v-if="isEditing"
        ref="editor"
        v-model="editableContent"
        class="text-editor"
        spellcheck="false"
        :disabled="isReplacing"
      />
      <pre v-else>
        <code
          v-if="isText"
          ref="codeblock"
          class="codeblock"
          :class="subtype"
          v-html="escapeHTMLData(fileData)"
        />
        <code
          v-if="!isText"
          ref="codeblock"
          class="codeblock"
          :class="subtype"
        >{{ fileData }}</code>
      </pre>
    </div>
  </div>
</template>

<script>
import hljs from "highlight.js";

import StaticViewer from "../../mixins/static-viewer";
import GetFileProperty from "../../mixins/get-file-property";
import Request from "../../mixins/request";
import EventBus from "../../utils/event-bus";

import "highlight.js/styles/github.css";

// import 'highlightjs/styles/color-brewer.css'
const PLAIN_TEXT_EXTENSIONS = [".lay"];

const escapeHTML = (str) =>
  (str + "").replace(
    /[&<>"'`=\/]/g,
    (s) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
        "/": "&#x2F;",
        "`": "&#x60;",
        "=": "&#x3D;",
      }[s])
  );

export default {
  name: "TextViewer",

  mixins: [StaticViewer, GetFileProperty, Request],

  props: {
    pkg: {
      type: Object,
      default: () => {},
    },
    idx: {
      type: Number,
      default: 0,
    },
    isPreview: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      fileData: "",
      // Whether the file has been fully fetched into fileData yet — gates
      // the Edit affordance so we never offer editing of an empty buffer.
      dataLoaded: false,
      isEditing: false,
      isReplacing: false,
      editableContent: "",
    };
  },

  computed: {
    /**
     * Compute subtype from Package DTO
     */
    subtype: function () {
      return this.getFilePropertyVal(
        this.pkg.properties,
        "subtype"
      ).toLowerCase();
    },

    isText: function () {
      return this.subtype === "text";
    },

    isPlainText: function () {
      const name = (this.pkg?.content?.name || "").toLowerCase();
      return PLAIN_TEXT_EXTENSIONS.some((ext) => name.endsWith(ext));
    },

    // Editing is offered once content has loaded. TextViewer only ever
    // renders text, so any file it shows is safe to edit as plain text.
    canEdit: function () {
      return this.dataLoaded && !this.isPreview;
    },

    isDirty: function () {
      return this.editableContent !== this.fileData;
    },
  },

  watch: {
    fileUrl: {
      handler: function (url) {
        if (url) {
          this.getData(url);
        }
      },
      immediate: true,
    },
  },

  methods: {
    escapeHTMLData: function (str) {
      return (str + "").replace(
        /[&<>"'`=\/]/g,
        (s) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
            "/": "&#x2F;",
            "`": "&#x60;",
            "=": "&#x3D;",
          }[s])
      );
    },
    /**
     * Fetch file data
     * @param {String} url
     */
    getData: function (url) {
      // NOTE: We could augment the Request mixin to handle text responses
      // instead of using fetch here
      fetch(url)
        .then((response) => response.text())
        .then((data) => {
          this.fileData = data;
          this.dataLoaded = true;
          this.applyHighlight();
        })
        .catch(this.handleXhrError.bind(this));
    },

    // Re-run syntax highlighting on the display code block. Skipped for
    // plain-text formats (.lay) and while the editor textarea is mounted.
    applyHighlight: function () {
      if (this.isPlainText || this.isEditing) {
        return;
      }
      this.$nextTick(() => {
        const codeblock = this.$refs.codeblock;
        if (codeblock) {
          hljs.configure();
          hljs.highlightBlock(codeblock);
        }
      });
    },

    startEdit: function () {
      this.editableContent = this.fileData;
      this.isEditing = true;
      this.$nextTick(() => {
        if (this.$refs.editor) {
          this.$refs.editor.focus();
        }
      });
    },

    cancelEdit: function () {
      this.isEditing = false;
      this.editableContent = "";
      this.applyHighlight();
    },

    /**
     * Upload the edited content as a replacement of the existing package,
     * reusing the upload module's onConflict='replace' path.
     */
    replaceFile: async function () {
      if (this.isReplacing || !this.isDirty) {
        return;
      }
      this.isReplacing = true;
      const newContent = this.editableContent;
      try {
        const { parentId } = await this.$store.dispatch(
          "uploadModule/replaceFileWithText",
          {
            pkg: this.pkg,
            content: newContent,
          }
        );
        EventBus.$emit("toast", {
          detail: {
            type: "success",
            msg: `Replacing ${this.pkg?.content?.name || "file"}…`,
          },
        });
        // The replace recreates the package asynchronously under a new id,
        // so the current viewer URL is now stale. Send the user back to the
        // file listing (parent collection, or the dataset root) where the
        // new file lands via the normal refresh.
        const { orgId, datasetId } = this.$route.params;
        this.$router.push(
          parentId
            ? {
                name: "collection-files",
                params: { orgId, datasetId, fileId: parentId },
              }
            : { name: "dataset-files", params: { orgId, datasetId } }
        );
      } catch (err) {
        console.error(err);
        EventBus.$emit("toast", {
          detail: {
            type: "error",
            msg: `Failed to replace file: ${err.message || "Unknown error"}`,
          },
        });
      } finally {
        this.isReplacing = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@use "../../styles/theme";

.text-viewer {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  height: 100%;
  background: white;
  border: 1px solid theme.$gray_3;
}

.text-viewer-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid theme.$gray_2;
  background: theme.$gray_1;
}

.tv-btn {
  padding: 4px 16px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: white;
  color: theme.$gray_5;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1.4;

  &:hover:not(:disabled) {
    border-color: theme.$purple_1;
    color: theme.$purple_1;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--primary {
    background: theme.$purple_1;
    border-color: theme.$purple_1;
    color: white;

    &:hover:not(:disabled) {
      color: white;
      opacity: 0.9;
    }
  }
}

.wrapper {
  flex: 1;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  overflow: auto;
}

.text-editor {
  width: 100%;
  height: 100%;
  min-height: 300px;
  box-sizing: border-box;
  padding: 12px;
  border: none;
  outline: none;
  resize: none;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre;
  tab-size: 4;
}

.codeblock {
  overflow: visible;
}

pre {
  white-space: pre-wrap;
}
</style>
