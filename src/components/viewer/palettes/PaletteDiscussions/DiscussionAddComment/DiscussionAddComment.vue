<template>
  <div
    class="discussion-add-comment"
    :class="{
      'start-discussion': startDiscussion,
      'mentions-open': tribute.isActive,
    }"
  >
    <div class="discussion-add-comment-top">
      <div class="input-wrap">
        <avatar class="mr-8" />

        <div
          ref="input"
          class="input mr-8"
          spellcheck="false"
          @input="onInput"
          @focus="onFocusBlur"
          @blur="onFocusBlur"
          @keydown.enter.prevent="onSubmit"
          @keydown.down="focusMention"
          @keydown.up="focusMention"
        />

        <button v-if="!hasValue" @click="showMentionMenu">
          <IconSharingIllustration :height="20" :width="26" />
        </button>
      </div>
      <div v-if="hasValue" class="add-comment-bottom mt-16">
        <div class="controls">
          <bf-button class="compact" :processing="isLoading" @click="onSubmit">
            Save
          </bf-button>
          <button v-if="isLoading === false" @click="reset">Discard</button>
        </div>
        <button @click="showMentionMenu">
          <IconSharingIllustration :height="20" :width="26" />
        </button>
      </div>
    </div>

    <div
      ref="mentionsContainer"
      class="mentions-wrap"
      :class="{
        offscreen: mentionsOffscreen,
      }"
    />

    <p v-if="hasValue || isFocused" class="discussion-add-comment-helper">
      @mention someone to invite them to discuss.
    </p>
  </div>
</template>

<script>
import { mapState, mapActions } from "vuex";
import {
  path,
  propOr,
  pathOr,
  prop,
  compose,
  head,
  defaultTo,
  last,
} from "ramda";

import Tribute from "tributejs";

import Avatar from "../../../../shared/avatar/Avatar.vue";
import BfButton from "../../../../shared/bf-button/BfButton.vue";
import Request from "../../../../../mixins/request";
import IconSharingIllustration from "../../../../icons/IconSharingIllustration.vue";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";

const transformComment = function (mention) {
  const values = mention.match(/"([^"]*)"/g);

  let mentionTag = `[${head(values)}](${last(values)})`;
  return mentionTag.replace(/\"/g, "");
};

const getInitial = (propName, data) =>
  compose(head, defaultTo(""), propOr("", propName))(data);

export default {
  name: "DiscussionAddComment",

  components: {
    IconSharingIllustration,
    Avatar,
    BfButton,
  },

  mixins: [Request],

  props: {
    startDiscussion: {
      type: Boolean,
      default: false,
    },
    discussion: {
      type: Object,
      default: function () {
        return {};
      },
    },
    annotationId: {
      type: Number,
      default: null,
    },
  },

  data() {
    return {
      tribute: {},
      value: "",
      isFocused: false,
      isLoading: false,
      mentionsOffscreen: false,
    };
  },

  computed: {
    ...mapState("viewerModule", ["activeViewer"]),
    ...mapState(["orgMembers", "config"]),

    /**
     * Compute if the input has a value
     * @returns {Boolean}
     */
    hasValue: function () {
      return this.value !== "";
    },
  },

  watch: {
    /**
     * Watch when orgMembers is defined and init Tribute library for mentions
     */
    orgMembers: {
      handler: function (val) {
        if (val.length && Object.keys(this.tribute).length === 0) {
          this.$nextTick(() => {
            this.initTribute();
          });
        }
      },
      immediate: true,
    },
    /**
     * Watch property for mentions menu open and set offscreen property
     */
    "tribute.isActive": function (val) {
      if (val) {
        this.checkMentionsCollision();
      }
    },
  },

  mounted: function () {
    this.$refs.input.addEventListener(
      "tribute-replaced",
      this.onTributeReplaced.bind(this)
    );
  },

  beforeDestroy: function () {
    this.tribute.detach(this.$refs.input);
    this.$refs.input.removeEventListener(
      "tribute-replaced",
      this.onTributeReplaced.bind(this)
    );
  },

  methods: {
    ...mapActions("viewerModule", ["createDiscussion", "createComment"]),

    /**
     * Initialize tribute library
     */
    initTribute: function () {
      // Initialize tribute
      this.tribute = new Tribute({
        values: this.orgMembers,
        // Custom lookup to match the shape of orgMembers
        lookup: (person, mentionText) => {
          return `${person.firstName} ${person.lastName}`;
        },
        selectTemplate: (item) => {
          return `<span data-profile-name="${item.original.firstName} ${item.original.lastName}" contenteditable="false" class="discussion-mention" data-profile-id="${item.original.id}">@${item.original.firstName} ${item.original.lastName}</span>`;
        },
        allowSpaces: true,
        menuContainer: this.$refs.mentionsContainer,
        positionMenu: false,
        menuItemTemplate: function (item) {
          const firstInitial = getInitial("firstName", item.original);
          const lastInitial = getInitial("lastName", item.original);
          const color = pathOr("", ["original", "color"], item);

          return `<div class="avatar-circle mr-8" style="background-color:${color}"><span class="avatar-initials">${firstInitial}${lastInitial}</span></div>${item.string}`;
        },
        searchOpts: {
          pre: "<strong>",
          post: "</strong>",
        },
      });

      // Attach tribute to the input element
      this.tribute.attach(this.$refs.input);
    },

    /**
     * Show mentions menu
     */
    showMentionMenu: function () {
      if (this.tribute.isActive === false) {
        const input = this.$refs.input;
        this.tribute.showMenuForCollection(input);
      }
    },

    /**
     * Set value on input of input field
     */
    onInput: function (evt) {
      this.value = evt.target.innerHTML;
    },

    /**
     * Set value on mention selection
     */
    onTributeReplaced: function (evt) {
      this.value = this.$refs.input.innerHTML;
    },

    /**
     * On submit, start discussion or add a comment
     */
    onSubmit: function (evt) {
      // Prevent empty discussion from being created
      if (this.value === "" || this.tribute.isActive) {
        return;
      }

      if (this.startDiscussion) {
        this.sendCreateDiscussionRequest();
      } else {
        this.addComment();
      }
    },

    /**
     * Create body for API request
     * @returns {Object}
     */
    createBody: function () {
      // Get IDs of all mentions
      const mentionEls = this.$el.querySelectorAll(".discussion-mention");
      const mentions = [];
      mentionEls.forEach(function (mention) {
        const id = mention.getAttribute("data-profile-id");
        mentions.push(id);
      });

      /**
       * Transform message to API friendly format: `[firstName lastName](ID)`
       */
      const message = this.value.replace(
        /\<span(.*?)\<\/span>/g,
        transformComment
      );

      const packageId = pathOr("", ["content", "id"], this.activeViewer);

      return {
        mentions,
        message,
        packageId,
      };
    },

    /**
     * Add comment to existing discussion
     */
    addComment: function () {
      const body = this.createBody();
      const discussionId = propOr("", "id", this.discussion);
      body["discussionId"] = discussionId;

      useGetToken()
        .then((token) => {
          const url = `${this.config.apiUrl}/discussions?api_key=${token}`;
          return useSendXhr(url, {
            method: "POST",
            body,
          }).then((response) => {
            const comment = prop("comment", response);
            if (comment) {
              this.createComment(comment);
            }

            this.reset();
          });
        })
        .catch(this.handleXhrError.bind(this));
    },

    /**
     * Create discussion
     */
    sendCreateDiscussionRequest: function () {
      const body = this.createBody();
      const packageType = pathOr(
        "",
        ["content", "packageType"],
        this.activeViewer
      );

      if (this.annotationId) {
        const annotationKey =
          packageType === "TimeSeries"
            ? "timeSeriesAnnotationId"
            : "annotationId";
        body[annotationKey] = this.annotationId;
      }

      useGetToken()
        .then((token) => {
          const url = `${this.config.apiUrl}/discussions?api_key=${token}`;
          this.sendXhr(url, {
            method: "POST",
            body,
          }).then((response) => {
            this.createDiscussion(response);
            this.reset();
          });
        })
        .catch(this.handleXhrError.bind(this));
    },

    /**
     * Sets isFocused based off event type (focus or blur)
     * @param {Event} evt
     */
    onFocusBlur: function (evt) {
      this.isFocused = evt.type === "focus";
      // remove input if empty
      if (this.value === "" && evt.type === "blur") {
        this.reset();
      }
    },

    /**
     * Reset the component
     */
    reset: function () {
      this.value = "";
      this.$refs.input.innerHTML = "";
      this.$emit("update:annotationId", null);
      this.$emit("reset");
    },

    /**
     * Focus on the input
     */
    focus: function () {
      this.$nextTick(() => {
        this.$refs.input.focus();
      });
    },

    /**
     * Check the position of the mentions wrapper in relation
     * to the window and set offscreen property to flip it
     */
    checkMentionsCollision: function () {
      this.$nextTick(() => {
        const mentionsContainer = this.$refs.mentionsContainer;
        const bounds = mentionsContainer.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        this.mentionsOffscreen = bounds.height + bounds.top > windowHeight;
      });
    },

    /**
     * Focus on mention when the user is scrolling with the keyboard
     */
    focusMention: function () {
      if (this.tribute.isActive) {
        this.$nextTick(() => {
          const el = this.tribute.menuContainer.querySelector("li.highlight");
          if (el) {
            el.scrollIntoView();
          }
        });
      }
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../../../styles/theme" as *;

.discussion-add-comment {
  border-top: 1px solid $gray_2;
  position: relative;
  &.start-discussion {
    border-top: none;
    .discussion-add-comment-top {
      border-bottom: 1px solid $gray_2;
    }
  }
}
.discussion-add-comment-top {
  background: #fff;
  .mentions-open & {
    position: relative;
    z-index: 100;
  }
}

.discussion-add-comment-top,
.discussion-add-comment-helper {
  padding: 8px;
}
.input-wrap {
  display: flex;
}
.input {
  align-self: center;
  flex: 1;
  font-size: 13px;
}
.add-comment-bottom {
  display: flex;
}
.controls {
  flex: 1;
}
.discussion-add-comment-helper {
  background: theme.$gray_2;
  color: theme.$gray_4;
  font-size: 12px;
  margin: 0;
  padding: 8px;
  .start-discussion & {
    background: none;
  }
}
</style>
<style lang="scss">
@use "../../../../../styles/theme" as *;

.discussion-mention {
  color: theme.$app-primary-color;
}

.mentions-wrap {
  background: #fff;
  bottom: 0;
  box-shadow: 1px 4px 10px 0 rgba(0, 0, 0, 0.35);
  overflow-x: hidden;
  overflow-y: scroll;
  position: absolute;
  max-height: 230px;
  transform: translateY(100%);
  width: 100%;
  z-index: 100;
  &.offscreen {
    bottom: auto;
    top: 0;
    transform: translateY(-100%);
  }
  ul {
    margin: 0;
    padding: 0;
  }
  li {
    align-items: center;
    cursor: pointer;
    color: #000;
    list-style: none;
    padding: 5px 10px;
    outline: none;
    text-decoration: none;
  }
  .highlight,
  li:hover {
    background: theme.$app-primary-color;
    color: #fff;
    cursor: pointer;
  }
}
.avatar-circle {
  position: relative;
  align-items: center;
  background: theme.$app-primary-color;
  border-radius: 50%;
  box-sizing: border-box;
  color: theme.$white;
  display: inline-flex;
  font-weight: 600;
  height: 32px;
  justify-content: center;
  overflow: hidden;
  width: 32px;
}
.avatar-initials {
  font-weight: 500;
  line-height: 1;
  text-transform: uppercase;
}
</style>
