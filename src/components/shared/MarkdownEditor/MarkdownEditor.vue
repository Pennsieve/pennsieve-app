<template>
  <div class="markdown-editor">
    <div v-show="isLoading === false">
      <div
        v-if="isEditing"
        class="markdown-editor-toolbar"
      >
        <div class="markdown-editor-tools markdown-controls">
          <button
            class="markdown-controls-button mr-8"
            :class="{ 'active': editMode === 'edit' }"
            @click="setModeEdit"
          >
            Update
          </button>
          <button
            class="markdown-controls-button mr-8"
            :class="{ 'active': editMode === 'preview' }"
            @click="setModePreview"
          >
            Preview
          </button>
          <a
            href="https://docs.pennsieve.io/docs/markdown-guide"
            target="_blank"
          >
            Markdown Help
          </a>
        </div>

        <div class="markdown-editor-tools markdown-tools">
          <button
            class="btn-markdown-tool"
            title="Heading <h1>, <h2>, ... ⌘+D"
            @click="markdownCommand('Heading <h1>, <h2>, ... ⌘+D')"
          >
            <IconToolbarTextHeading
              :height="24"
              :width="24"
            />
          </button>
          <button
            class="btn-markdown-tool"
            title="Strong <strong> ⌘+B"
            @click="markdownCommand('Strong <strong> ⌘+B')"
          >
            <IconToolbarTextBold
              :height="24"
              :width="24"
            />
          </button>
          <button
            class="btn-markdown-tool"
            title="Emphasis <em> ⌘+I"
            @click="markdownCommand('Emphasis <em> ⌘+I')"
          >
            <IconToolbarTextItalic
              :height="24"
              :width="24"
            />
          </button>
          <button
            class="btn-markdown-tool"
            title="Hyperlink <a> ⌘+K"
            @click="hyperLinkCommand"
          >
            <IconToolbarLink
              :height="24"
              :width="24"
            />
          </button>
          <button
            class="btn-markdown-tool"
            title="Bulleted List <ul> ⌘+U"
            @click="markdownCommand('Bulleted List <ul> ⌘+U')"
          >
            <IconToolbarListBulleted
              :height="24"
              :width="24"
            />
          </button>
          <button
            class="btn-markdown-tool"
            title="Numbered List <ol> ⌘+O"
            @click="markdownCommand('Numbered List <ol> ⌘+O')"
          >
            <IconToolbarListNumbered
              :height="24"
              :width="24"
            />
          </button>
          <button
            class="btn-markdown-tool"
            title="Blockquote <blockquote> ⌘+J"
            @click="markdownCommand('Blockquote <blockquote> ⌘+J')"
          >
            <IconToolbarQuote
              :height="24"
              :width="24"
            />
          </button>
        </div>
      </div>

      <div
        v-show="isEditing && editMode === 'edit'"
        v-loading="isSaving"
        class="markdown-edit-wrap"
        element-loading-background="#fff"
      >
        <div class="textarea-wrap content-wrap">
          <textarea
            ref="textarea"
            v-model="markdown"
          />
        </div>
      </div>

      <div
        v-show="isEditing === false || editMode === 'preview'"
        v-loading="isSaving"
        class="content-wrap"
        element-loading-background="#fff"
      >
        <div v-html="parsedMarkdown" />
      </div>
    </div>

    <div
      v-if="isLoading"
      class="is-loading-wrap content-wrap"
    >
      <content-loader
        :height="426"
        :width="644"
        :speed="2"
        primary-color="#f3f3f3"
        secondary-color="#ecebeb"
      >
        <rect
          x="0"
          y="0"
          rx="4"
          ry="4"
          width="340"
          height="24"
        />
        <rect
          x="0"
          y="44"
          rx="4"
          ry="4"
          width="561"
          height="24"
        />
        <rect
          x="0"
          y="88"
          rx="4"
          ry="4"
          width="520"
          height="24"
        />
        <rect
          x="0"
          y="132"
          rx="4"
          ry="4"
          width="456"
          height="250"
        />
        <rect
          x="0"
          y="402"
          rx="4"
          ry="4"
          width="530"
          height="24"
        />
      </content-loader>
    </div>
  </div>
</template>

<script>
  import {marked} from 'marked'
  import woofmark from 'woofmark'
  import { ContentLoader } from 'vue-content-loader'

  import 'woofmark/dist/woofmark.css';
  import IconToolbarTextHeading from "../../icons/IconToolbarTextHeading.vue";
  import IconToolbarTextBold from "../../icons/IconToolbarTextBold.vue";
  import IconToolbarTextItalic from "../../icons/IconToolbarTextItalic.vue";
  import IconToolbarLink from "../../icons/IconToolbarLink.vue";
  import IconToolbarListBulleted from "../../icons/IconToolbarListBulleted.vue";
  import IconToolbarListNumbered from "../../icons/IconToolbarListNumbered.vue";
  import IconToolbarQuote from "../../icons/IconToolbarQuote.vue";

  marked.setOptions({
    sanitize: true
  })

  const hyperLinkCommand = (chunks, mode) => {
    const selection = chunks.selection

    // Required to get all text entered before and after the cursor
    const before = chunks.before
    const after = chunks.after

    if (selection) {
      chunks.before += `[${selection}](`
      chunks.selection = 'url'
      chunks.after = `)${after}`
    } else {
      chunks.before += `[`
      chunks.selection = ''
      chunks.after = `](url)${after}`
    }
  }

  export default {
    name: 'MarkdownEditor',

    components: {
      IconToolbarQuote,
      IconToolbarListNumbered,
      IconToolbarListBulleted,
      IconToolbarLink,
      IconToolbarTextItalic,
      IconToolbarTextBold,
      IconToolbarTextHeading,
      ContentLoader
    },

    props: {
      isEditing: {
        type: Boolean,
        default: false
      },
      isSaving: {
        type: Boolean,
        default: false
      },
      value: {
        type: String,
        default: ''
      },
      emptyState: {
        type: String,
        default: '# Enter a value'
      },
      isLoading: {
        type: Boolean,
        default: false
      }
    },

    data: function() {
      return {
        editor: {},
        parsedMarkdown: '',
        markdown: '',
        editMode: 'edit'
      }
    },

    watch: {
      /**
       * Watching isEditing prop
       * @params {Boolean} isEditing
       */
      isEditing: function(isEditing) {
        if (isEditing) {
          this.edit()
        }
      },

      isSaving: function(isSaving) {
        if (isSaving) {
          this.save()
        }
      },

      /**
       * Watch value and parse markdown to render
       */
      value: function() {
        this.parseMarkdown()
      }
    },

    mounted: function() {
      this.initEditor()
      this.parseMarkdown()
    },

    beforeUnmount: function() {
      // Destroy the editor
      const hasEditor = woofmark.find(this.$refs.textarea)
      if (hasEditor) {
        this.editor.destroy()
      }
    },

    methods: {
      /**
       * Focus on the input
       */
      focus: function() {
        this.$refs.textarea.focus()
      },

      /**
       * Initialize the editor
       */
      initEditor: function() {
        const textarea = this.$refs.textarea

        const hasEditor = woofmark.find(textarea)

        if (hasEditor === null) {
          this.editor = woofmark(textarea, {
            html: false,
            wysiwyg: false,
            defaultMode: 'markdown',
            parseMarkdown: marked
          })

          this.editor.addCommand('cmd+k', function jump (e, mode, chunks) {
            hyperLinkCommand(chunks)
          })
        }
      },

      /**
       * Set model edit
       */
      setModeEdit: function() {
        this.editMode = 'edit'
      },

      /**
       * Set model edit
       */
      setModePreview: function() {
        this.markdown = this.$refs.textarea.value
        this.parsedMarkdown = this.editor.parseMarkdown(this.markdown)
        this.editMode = 'preview'
      },

      /**
       * On edit, focus the textarea
       */
      edit: function() {
        this.markdown = this.value
        this.editMode = 'edit'
        this.$nextTick(() => {
          this.$refs.textarea.focus()
        })
      },

      /**
       * On save, parse and emit markdown
       */
      save: function() {
        this.markdown = this.$refs.textarea.value
        this.$emit('save', this.markdown)
      },

      /**
       * Parse the markdown using marked.js
       */
      parseMarkdown: function() {
        const markdown = this.value !== ''
          ? this.value
          : this.emptyState
        this.parsedMarkdown = this.editor.parseMarkdown(markdown)
      },

      /**
       * Run markdown command by title
       * This triggers a wk-button click
       * @param {String} title
       */
      markdownCommand: function(title) {
        // Event.preventDefault()

        // const wkButton = this.$el.querySelector(`.wk-command[title="${title}"]`)
        // if (wkButton) {
        //   wkButton.click()
        // }
      },

      /**
       * Custom command to add hyperlink
       */
      hyperLinkCommand: function() {
        this.editor.runCommand(hyperLinkCommand)
      }
    }
  }
</script>

<style lang="scss" scoped>
  @use '../../../styles/theme';
  @use './_markdown.scss' as *;

  textarea {
    font: 14px/1.1 monospace;
    max-width: 100%;
    min-height: 500px;
    min-width: 100%;
    outline: none;
    padding: 0;
    width: 100%;
  }

  .markdown-edit-wrap {
    position: relative;
  }

  .content-wrap {
    padding: 16px;
  }

  .markdown-editor-toolbar {
    align-items: center;
    background: theme.$gray_1;
    border-bottom: 1px solid theme.$gray_2;
    display: flex;
    flex-wrap: wrap;
    padding: 8px 16px 0;
  }

  .markdown-editor-tools {
    align-items: center;
    display: flex;
  }
  .markdown-controls {
    flex: 1;
    min-width: 280px;
    a {
      font-size: 12px;
    }
  }
  .markdown-controls-button {
    border-radius: 4px 4px 0 0;
    border: 1px solid theme.$gray_2;
    color: theme.$gray_4;
    cursor: pointer;
    padding: 13px 22px;
    transform: translateY(1px);
    &.active {
      background: #fff;
      border-bottom-color: #fff;
      color: theme.$gray_6
    }
  }

  .btn-markdown-tool {
    border: 1px solid transparent;
    border-radius: 3px;
    height: 32px;
    width: 32px;
    &:hover, &:focus {
      background: #e4e4ee;
      border-color: #c5c9d1;
    }
  }
  .is-loading-wrap {
    height: auto;
    max-width: 600px;
  }
  .markdown-editor {
    .wk-container {
      padding-top: 35px;
      position: relative;
    }
    .wk-commands,
    .wk-switchboard {
      display: none;
    }
  }
  .wk-prompt {
    display: none;
  }
</style>
