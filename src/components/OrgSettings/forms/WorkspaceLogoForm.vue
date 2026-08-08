<template>
  <div class="workspace-logo-form">
    <div class="form-section">
      <h4 class="section-title">Workspace Logo</h4>

      <div class="form-field">
        <p class="field-description">
          Shown next to the workspace name in navigation and the workspace
          switcher. PNG, JPEG or WebP, up to 2&nbsp;MB. Any shape works — wide
          wordmarks are kept as they are, never cropped or padded. For the
          sharpest result, use an image at least 512&nbsp;pixels on its longest
          side.
        </p>

        <div class="logo-row">
          <div
            class="logo-drop"
            :class="{ 'is-dragging': isDragging, 'is-disabled': !hasAdminRights }"
            @click="openImageSelector"
            @dragenter="setIsDragging(true)"
            @dragover.prevent="setIsDragging(true)"
            @dragleave="setIsDragging(false)"
            @drop.prevent="setImage($event, true)"
          >
            <workspace-logo :size="96" />
          </div>

          <div class="logo-actions">
            <bf-button
              v-if="hasAdminRights"
              class="secondary"
              @click="openImageSelector"
            >
              {{ hasLogo ? "Replace Logo" : "Upload Logo" }}
            </bf-button>

            <bf-button
              v-if="hasAdminRights && hasLogo"
              class="secondary destructive"
              :loading="isRemoving"
              @click="removeLogo"
            >
              Remove
            </bf-button>

            <p v-if="!hasAdminRights" class="no-permission-text">
              You need admin rights to change the workspace logo.
            </p>
          </div>
        </div>

        <p v-if="errorMessage" class="invalid-image-type">
          {{ errorMessage }}
        </p>

        <input
          v-show="false"
          ref="inputFile"
          type="file"
          :accept="validPickerTypes"
          multiple="false"
          @change="setImage"
        />
      </div>
    </div>

    <el-dialog
      v-model="isDialogVisible"
      :show-close="false"
      :close-on-click-modal="false"
      @closed="closeDialog"
    >
      <template #header>
        <bf-dialog-header title="Update workspace logo" />
      </template>

      <dialog-body>
        <div v-loading="isLoadingImage" class="cropper-wrap">
          <img ref="img" src="" alt="" />
        </div>
        <p class="cropper-hint">
          The whole image is selected by default. Drag to crop if you want to
          trim surrounding whitespace — any shape is fine.
        </p>
      </dialog-body>

      <template #footer>
        <div class="dialog-footer">
          <bf-button class="secondary" @click="isDialogVisible = false">
            Cancel
          </bf-button>
          <bf-button
            :processing="isUploading"
            processing-text="Saving"
            @click="saveLogo"
          >
            Save
          </bf-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { mapActions, mapGetters, mapState } from "vuex";
import { head, propOr } from "ramda";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";

import BfButton from "../../shared/bf-button/BfButton.vue";
import BfDialogHeader from "../../shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "../../shared/dialog-body/DialogBody.vue";
import WorkspaceLogo from "../../shared/WorkspaceLogo/WorkspaceLogo.vue";
import EventBus from "@/utils/event-bus";

// The API's hard limit, applied to what we actually send.
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
// Bounds the longer side of the uploaded logo. Matches the service's canonical
// rendition, so the server does not have to resize what we send.
const MAX_LOGO_DIMENSION = 512;

// A far looser bound on the file the user picks. The cropper re-encodes to a
// bounded PNG before upload, so a large source does not mean a large upload —
// this only exists to stop FileReader chewing on something absurd.
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export default {
  name: "WorkspaceLogoForm",

  components: {
    BfButton,
    BfDialogHeader,
    DialogBody,
    WorkspaceLogo,
  },

  data() {
    return {
      isDialogVisible: false,
      isLoadingImage: true,
      isDragging: false,
      isRemoving: false,
      cropper: null,
      selectedImageFile: null,
      errorMessage: "",
      validImageTypes: [
        { type: "image/png", name: "PNG" },
        { type: "image/jpeg", name: "JPEG" },
        { type: "image/webp", name: "WebP" },
      ],
    };
  },

  computed: {
    ...mapState(["activeOrganization"]),
    ...mapState("workspaceLogoModule", ["isUploading"]),
    ...mapGetters("workspaceLogoModule", ["activeWorkspaceLogo"]),

    hasLogo() {
      return Boolean(this.activeWorkspaceLogo);
    },

    hasAdminRights() {
      const isAdmin = propOr(false, "isAdmin", this.activeOrganization);
      const isOwner = propOr(false, "isOwner", this.activeOrganization);
      return isAdmin || isOwner;
    },

    validPickerTypes() {
      return this.validImageTypes.map((el) => el.type).join(",");
    },

    invalidImageErrorMessage() {
      const types = this.validImageTypes.map((type) => type.name).join(", ");
      return `Invalid file type. Please choose a ${types} file.`;
    },
  },

  methods: {
    ...mapActions("workspaceLogoModule", ["uploadLogo", "deleteLogo"]),

    setIsDragging(isDragging) {
      this.isDragging = isDragging;
    },

    openImageSelector() {
      if (!this.hasAdminRights) {
        return;
      }
      this.$refs.inputFile.click();
    },

    closeDialog() {
      this.isDialogVisible = false;
      this.$refs.img.src = "";
      this.$refs.inputFile.value = "";
      this.selectedImageFile = null;
      if (this.cropper) {
        this.cropper.destroy();
        this.cropper = null;
      }
    },

    isValidImage(image) {
      const fileType = (image && image.type) || "";
      return this.validImageTypes.some((imageType) => fileType === imageType.type);
    },

    setImage(evt, isDropping = false) {
      this.isDragging = false;
      this.errorMessage = "";

      const files = isDropping ? evt.dataTransfer.files : this.$refs.inputFile.files;
      const image = head(files);
      if (!image) {
        return;
      }

      if (!this.isValidImage(image)) {
        this.errorMessage = this.invalidImageErrorMessage;
        return;
      }
      // Deliberately not the API's 2 MB limit: the cropper re-encodes and
      // bounds the image before upload, so a 12 MB photo still produces a
      // small PNG. Rejecting the source at 2 MB would turn away images that
      // upload perfectly well.
      if (image.size > MAX_SOURCE_BYTES) {
        this.errorMessage = "That image is too large to open. Please choose a file under 25 MB.";
        return;
      }

      this.selectedImageFile = image;
      this.isLoadingImage = true;
      this.isDialogVisible = true;

      const reader = new FileReader();
      reader.addEventListener(
        "load",
        () => {
          this.$refs.img.src = reader.result;
          this.initCropper();
        },
        false
      );
      reader.readAsDataURL(image);
    },

    initCropper() {
      if (this.cropper) {
        this.cropper.destroy();
      }
      this.cropper = new Cropper(this.$refs.img, {
        // Free-form: logos are frequently wide wordmarks, and forcing a square
        // selection made users letterbox them by hand. autoCropArea 1 selects
        // the whole image, so anyone who just wants to upload can click
        // straight through; cropping is there to trim whitespace.
        aspectRatio: NaN,
        responsive: false,
        // viewMode 1 keeps the selection inside the image. With no fixed
        // ratio there is no longer any reason to select beyond its edges.
        viewMode: 1,
        autoCropArea: 1,
      });

      this.isLoadingImage = false;
    },

    saveLogo() {
      // Bound the longer side and keep the selection's own proportions, rather
      // than forcing a square. Never upscales: a small crop stays small, since
      // blowing it up would only add blur.
      const crop = this.cropper.getData();
      const longest = Math.max(crop.width, crop.height);
      const scale = Math.min(1, MAX_LOGO_DIMENSION / longest);

      // No fillColor: the canvas stays transparent outside the image, which is
      // what keeps a logo from picking up a white box against the nav.
      this.cropper
        .getCroppedCanvas({
          width: Math.max(1, Math.round(crop.width * scale)),
          height: Math.max(1, Math.round(crop.height * scale)),
          imageSmoothingQuality: "high",
        })
        .toBlob(
          async (blob) => {
            // This is the size that matters — the server sees this blob, not
            // the file the user picked. A bounded PNG is comfortably under the
            // limit in practice, so this only catches pathological cases.
            if (!blob || blob.size > MAX_UPLOAD_BYTES) {
              this.errorMessage =
                "The processed logo exceeds 2 MB. Please try a simpler image.";
              this.isDialogVisible = false;
              return;
            }

            try {
              await this.uploadLogo({ blob, contentType: "image/png" });
              this.isDialogVisible = false;
              EventBus.$emit("toast", {
                detail: { type: "MESSAGE", msg: "Workspace logo updated" },
              });
            } catch (err) {
              this.errorMessage = err.message || "Could not upload the logo.";
              this.isDialogVisible = false;
            }
          },
          "image/png"
        );
    },

    async removeLogo() {
      this.isRemoving = true;
      try {
        await this.deleteLogo();
        EventBus.$emit("toast", {
          detail: { type: "MESSAGE", msg: "Workspace logo removed" },
        });
      } finally {
        this.isRemoving = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.form-section {
  margin-bottom: 32px;
}

.section-title {
  margin-bottom: 8px;
}

.field-description {
  color: theme.$gray_5;
  margin-bottom: 16px;
}

.logo-row {
  align-items: center;
  display: flex;
  gap: 24px;
}

.logo-drop {
  align-items: center;
  border: 1px dashed theme.$gray_3;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  height: 128px;
  justify-content: center;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  width: 128px;

  &.is-dragging {
    background: theme.$gray_1;
    border-color: theme.$purple_2;
  }

  &.is-disabled {
    cursor: default;
  }
}

.logo-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.no-permission-text {
  color: theme.$gray_4;
}

.invalid-image-type {
  color: theme.$red_1;
  margin-top: 12px;
}

.cropper-wrap {
  background: theme.$gray_1;
  height: 420px;
  width: 100%;
}

.cropper-wrap img {
  max-width: 100%;
}

.cropper-hint {
  color: theme.$gray_4;
  margin-top: 12px;
}
</style>
