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
        <div
          v-loading="isLoadingImage"
          class="cropper-wrap"
          :class="{ 'is-previewing-white': renderWhite }"
        >
          <img ref="img" src="" alt="" />
        </div>
        <p class="cropper-hint">
          The whole image is selected by default. Drag to crop if you want to
          trim surrounding whitespace — any shape is fine.
        </p>

        <!-- Offered only for images that actually carry transparency. The
             knockout paints every opaque pixel, so on a JPEG - which has no
             alpha at all - it would return a plain white rectangle rather than
             a silhouette. -->
        <div v-if="sourceHasAlpha" class="white-option">
          <el-checkbox v-model="renderWhite">
            Render this logo in white
          </el-checkbox>
          <p class="cropper-hint">
            Logos are shown on the coloured nav rail and workspace cards, so a
            white mark reads on every surface. Colour and interior detail in the
            original are lost — best for single-colour marks and wordmarks.
          </p>
        </div>
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
// SVG is rasterised at twice the canonical dimension before it reaches the
// cropper, so cropping and the server's own downscale both work from detail
// the vector actually has rather than from a 512px approximation.
const SVG_RASTER_DIMENSION = MAX_LOGO_DIMENSION * 2;

// A far looser bound on the file the user picks. The cropper re-encodes to a
// bounded PNG before upload, so a large source does not mean a large upload —
// this only exists to stop FileReader chewing on something absurd.
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

// Longest side used when sampling for transparency. Only decides whether to
// offer the white option, so there is no reason to scan a full-size image.
const ALPHA_SAMPLE_DIMENSION = 128;

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
      // Whether the selected image has an alpha channel, which is what decides
      // if the white option is offered at all.
      sourceHasAlpha: false,
      renderWhite: false,
      validImageTypes: [
        { type: "image/png", name: "PNG" },
        { type: "image/jpeg", name: "JPEG" },
        { type: "image/webp", name: "WebP" },
        { type: "image/svg+xml", name: "SVG" },
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
      this.sourceHasAlpha = false;
      this.renderWhite = false;
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

      // SVG is converted to a raster here, so everything downstream - the
      // cropper and the API - only ever handles PNG. The service never
      // receives SVG, so it needs no sanitiser and no rasteriser.
      if (image.type === "image/svg+xml") {
        this.rasterizeSvg(image)
          .then((dataUrl) => {
            this.$refs.img.src = dataUrl;
            this.initCropper();
          })
          .catch(() => {
            this.errorMessage =
              "That SVG could not be read. Try exporting it as PNG instead.";
            this.isDialogVisible = false;
            this.isLoadingImage = false;
          });
        return;
      }

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

    // Reads an SVG's intrinsic aspect ratio. naturalWidth is unreliable here:
    // many logos carry only a viewBox, and browsers disagree on what to report
    // for those - Chrome commonly gives 300x150. DOMParser only parses; it
    // does not execute scripts or fetch anything.
    svgAspect(svgText) {
      const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
      const svg = doc.querySelector("svg");
      if (!svg || doc.querySelector("parsererror")) {
        return null;
      }

      const asPixels = (value) => {
        const parsed = parseFloat(value);
        // Reject percentages and other relative units; they say nothing about
        // the intrinsic ratio.
        if (!Number.isFinite(parsed) || parsed <= 0 || /%$/.test(value || "")) {
          return null;
        }
        return parsed;
      };

      const width = asPixels(svg.getAttribute("width"));
      const height = asPixels(svg.getAttribute("height"));
      if (width && height) {
        return { width, height };
      }

      const viewBox = (svg.getAttribute("viewBox") || "").split(/[\s,]+/);
      if (viewBox.length === 4) {
        const vbWidth = parseFloat(viewBox[2]);
        const vbHeight = parseFloat(viewBox[3]);
        if (vbWidth > 0 && vbHeight > 0) {
          return { width: vbWidth, height: vbHeight };
        }
      }

      return null;
    },

    // Renders an SVG to a PNG data url.
    //
    // Drawing through an <img> is deliberate: that is the browser's secure
    // static mode, where scripts do not run and external references are not
    // fetched. Injecting the markup into the document instead would execute it.
    rasterizeSvg(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("could not read file"));
        reader.onload = () => {
          const svgText = reader.result;
          const aspect = this.svgAspect(svgText);
          if (!aspect) {
            reject(new Error("no intrinsic dimensions"));
            return;
          }

          const scale = SVG_RASTER_DIMENSION / Math.max(aspect.width, aspect.height);
          const width = Math.max(1, Math.round(aspect.width * scale));
          const height = Math.max(1, Math.round(aspect.height * scale));

          const url = URL.createObjectURL(
            new Blob([svgText], { type: "image/svg+xml" })
          );
          const img = new Image();

          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            // No fill: the canvas stays transparent, so a logo with an alpha
            // background does not gain a white box.
            canvas
              .getContext("2d")
              .drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            try {
              resolve(canvas.toDataURL("image/png"));
            } catch (err) {
              // Tainted canvas: the svg pulled in something cross-origin.
              reject(err);
            }
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("could not render svg"));
          };

          // Explicit dimensions so an SVG with only a viewBox still renders at
          // the size we want rather than a browser default.
          img.width = width;
          img.height = height;
          img.src = url;
        };
        reader.readAsText(file);
      });
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
        // ready fires once the image has decoded, which is when its pixels can
        // actually be sampled.
        ready: () => {
          this.sourceHasAlpha = this.detectAlpha(this.$refs.img);
        },
      });

      this.isLoadingImage = false;
    },

    // Reports whether any pixel is less than fully opaque.
    //
    // Deliberately gated on transparency rather than on the file the user
    // picked. By this point an SVG has already been rasterised, so an
    // SVG-derived PNG and an uploaded PNG are the same thing and there is
    // nothing left to tell apart. Alpha is the property the knockout actually
    // depends on: it is what carries the mark's shape once the colour is
    // replaced. It also excludes JPEG for free, since JPEG cannot be
    // transparent and a knockout there would yield a solid white rectangle.
    //
    // Sampled at a reduced size: the result only gates a checkbox, and any
    // transparency in the source still reads as sub-255 alpha once downscaled.
    // The image is a data or object URL from the user's own file, so the canvas
    // is same-origin and getImageData cannot taint.
    detectAlpha(img) {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (!width || !height) {
        return false;
      }

      const scale = Math.min(1, ALPHA_SAMPLE_DIMENSION / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));

      const context = canvas.getContext("2d");
      context.drawImage(img, 0, 0, canvas.width, canvas.height);

      try {
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 255) {
            return true;
          }
        }
      } catch {
        // Not reachable with same-origin sources, but failing closed only hides
        // the option rather than offering one that would misbehave.
        return false;
      }

      return false;
    },

    // Repaints the mark white while leaving its alpha alone. source-in keeps
    // the destination's alpha and takes the source's colour, so anti-aliased
    // edges survive intact instead of hardening into a jagged silhouette.
    applyWhiteKnockout(canvas) {
      const context = canvas.getContext("2d");
      context.globalCompositeOperation = "source-in";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = "source-over";
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
      const canvas = this.cropper.getCroppedCanvas({
        width: Math.max(1, Math.round(crop.width * scale)),
        height: Math.max(1, Math.round(crop.height * scale)),
        imageSmoothingQuality: "high",
      });

      // Baked into the upload rather than applied at render time, so the stored
      // asset is what every surface shows and no consumer has to know about the
      // choice. Reversible by re-uploading with the box unticked.
      if (this.renderWhite) {
        this.applyWhiteKnockout(canvas);
      }

      canvas.toBlob(
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

/* Checkerboard rather than a flat fill. Uploads really are transparent -
   nothing in the pipeline fills a background - but a solid backdrop makes a
   transparent logo look identical to one with that colour baked in.

   Mid greys, not the usual white-on-light: workspace logos are frequently
   white, designed for the dark nav rail, and a light checker renders those
   invisible. This pair keeps both white and dark marks legible. */
@mixin transparency-checkerboard($size) {
  $half: $size * 0.5;

  background-color: theme.$gray_4;
  background-image: linear-gradient(45deg, theme.$gray_3 25%, transparent 25%),
    linear-gradient(-45deg, theme.$gray_3 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, theme.$gray_3 75%),
    linear-gradient(-45deg, transparent 75%, theme.$gray_3 75%);
  background-position: 0 0, 0 $half, $half (-$half), (-$half) 0;
  background-size: $size $size;
}


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
  @include transparency-checkerboard(10px);
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
    background-color: theme.$gray_2;
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
  @include transparency-checkerboard(16px);
  height: 420px;
  width: 100%;
}

.cropper-wrap img {
  max-width: 100%;
}

/* Previews the knockout on the cropper's own image, so the flattening is
   visible before saving rather than discovered afterwards in the nav.
   brightness(0) crushes every colour to black and invert(1) lifts it to white;
   alpha is untouched, so only the mark itself changes.

   Applied to the image elements rather than the container: filtering the whole
   cropper would take the crop handles and the mask overlay with it. */
.cropper-wrap.is-previewing-white :deep(.cropper-canvas img),
.cropper-wrap.is-previewing-white :deep(.cropper-view-box img) {
  filter: brightness(0) invert(1);
}

.white-option {
  margin-top: 16px;
}

.cropper-hint {
  color: theme.$gray_4;
  margin-top: 12px;
}
</style>
