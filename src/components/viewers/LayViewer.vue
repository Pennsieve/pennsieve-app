<template>
  <div class="lay-viewer">
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="sections">
      <div
        v-for="section in sections"
        :key="section.name"
        class="section"
      >
        <div class="section-header">{{ section.name }}</div>
        <div class="section-body">
          <!-- FileInfo: key-value pairs -->
          <table v-if="section.name === 'FileInfo'" class="kv-table">
            <tr v-for="(val, key) in section.entries" :key="key">
              <td class="kv-key">{{ key }}</td>
              <td class="kv-val">{{ val }}</td>
            </tr>
          </table>

          <!-- Patient: key-value pairs, hide empty -->
          <table v-else-if="section.name === 'Patient'" class="kv-table">
            <tr v-for="(val, key) in section.entries" :key="key" v-show="val">
              <td class="kv-key">{{ key }}</td>
              <td class="kv-val">{{ val }}</td>
            </tr>
            <tr v-if="allEmpty(section.entries)">
              <td class="kv-val empty" colspan="2">No patient data</td>
            </tr>
          </table>

          <!-- ChannelMap: two-column table -->
          <table v-else-if="section.name === 'ChannelMap'" class="channel-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Index</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(val, key) in section.entries" :key="key">
                <td>{{ key }}</td>
                <td class="channel-idx">{{ val }}</td>
              </tr>
            </tbody>
          </table>

          <!-- SampleTimes -->
          <table v-else-if="section.name === 'SampleTimes'" class="kv-table">
            <thead>
              <tr>
                <th>Sample</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(val, key) in section.entries" :key="key">
                <td>{{ key }}</td>
                <td>{{ val }}</td>
              </tr>
            </tbody>
          </table>

          <!-- Comments: parsed timeline with search -->
          <div v-else-if="section.name === 'Comments'" class="comments-section">
            <div class="comments-search">
              <input
                v-model="commentSearch"
                type="text"
                placeholder="Search comments..."
                class="search-input"
              />
              <span v-if="commentSearch" class="search-count">
                {{ matchCount }} matches
              </span>
            </div>
            <div class="comments-list">
              <div
                v-for="(comment, i) in parsedComments"
                :key="i"
                class="comment-row"
              >
                <span class="comment-time">{{ comment.time }}</span>
                <span class="comment-text" v-html="highlightMatch(comment.text)"></span>
              </div>
            </div>
          </div>

          <!-- Fallback: raw key=value -->
          <table v-else class="kv-table">
            <tr v-for="(val, key) in section.entries" :key="key">
              <td class="kv-key">{{ key }}</td>
              <td class="kv-val">{{ val }}</td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import StaticViewer from "../../mixins/static-viewer";
import GetFileProperty from "../../mixins/get-file-property";
import Request from "../../mixins/request";

export default {
  name: "LayViewer",

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
  },

  data() {
    return {
      sections: [],
      loading: true,
      error: "",
      commentSearch: "",
    };
  },

  computed: {
    matchCount() {
      if (!this.commentSearch) return 0;
      const query = this.commentSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(query, "gi");
      return this.parsedComments.reduce((total, c) => {
        const matches = c.text.match(regex);
        return total + (matches ? matches.length : 0);
      }, 0);
    },

    parsedComments() {
      const commentsSection = this.sections.find(
        (s) => s.name === "Comments"
      );
      if (!commentsSection) return [];

      return commentsSection.rawLines
        .map((line) => {
          const parts = line.split(",");
          if (parts.length < 5) return null;
          const timeSec = parseFloat(parts[0]);
          const duration = parseFloat(parts[1]);
          const text = parts.slice(4).join(",").trim();
          let time = this.formatTime(timeSec);
          if (duration > 0) {
            time += " \u2013 " + this.formatTime(timeSec + duration);
          }
          return { time, text };
        })
        .filter((c) => c && c.text);
    },
  },

  watch: {
    fileUrl: {
      handler(url) {
        if (url) {
          this.fetchAndParse(url);
        }
      },
      immediate: true,
    },
  },

  methods: {
    highlightMatch(text) {
      if (!this.commentSearch) return this.escapeHtml(text);
      const escaped = this.escapeHtml(text);
      const query = this.commentSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${query})`, "gi");
      return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
    },

    escapeHtml(str) {
      return (str + "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    },

    allEmpty(entries) {
      return Object.values(entries).every((v) => !v);
    },

    formatTime(seconds) {
      if (isNaN(seconds) || seconds < 0) return "";
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      if (h > 0) {
        return `${h}h ${m}m ${s}s`;
      }
      if (m > 0) {
        return `${m}m ${s}s`;
      }
      return `${s}s`;
    },

    fetchAndParse(url) {
      this.loading = true;
      this.error = "";
      fetch(url)
        .then((response) => response.text())
        .then((data) => {
          this.sections = this.parseLay(data);
          this.loading = false;
        })
        .catch((err) => {
          this.error = "Failed to load file";
          this.loading = false;
        });
    },

    parseLay(text) {
      const sections = [];
      let current = null;

      const lines = text.split(/\r?\n/);
      for (const line of lines) {
        const sectionMatch = line.match(/^\[(.+)\]$/);
        if (sectionMatch) {
          current = {
            name: sectionMatch[1],
            entries: {},
            rawLines: [],
          };
          sections.push(current);
          continue;
        }
        if (!current) continue;
        const trimmed = line.trim();
        if (!trimmed) continue;

        current.rawLines.push(trimmed);
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx);
          const val = trimmed.substring(eqIdx + 1);
          current.entries[key] = val;
        }
      }
      return sections;
    },
  },
};
</script>

<style lang="scss" scoped>
@use "../../styles/theme";

.lay-viewer {
  overflow: auto;
  width: 100%;
  height: 100%;
  background: white;
  padding: 16px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: theme.$gray_5;
}

.loading,
.error {
  padding: 24px;
  text-align: center;
  color: theme.$gray_4;
}

.error {
  color: #c00;
}

.section {
  margin-bottom: 16px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  overflow: hidden;
}

.section-header {
  background: theme.$gray_1;
  padding: 8px 16px;
  font-weight: 600;
  font-size: 14px;
  border-bottom: 1px solid theme.$gray_2;
}

.section-body {
  padding: 8px;
}

.kv-table,
.channel-table {
  width: 100%;
  border-collapse: collapse;
}

.kv-table td,
.kv-table th,
.channel-table td,
.channel-table th {
  padding: 4px 8px;
  text-align: left;
}

.kv-table th,
.channel-table th {
  font-weight: 600;
  color: theme.$gray_4;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid theme.$gray_2;
}

.kv-key {
  font-weight: 500;
  white-space: nowrap;
  width: 1%;
  color: theme.$gray_6;
}

.kv-val {
  color: theme.$gray_5;
}

.kv-val.empty {
  color: theme.$gray_4;
  font-style: italic;
}

.channel-table tbody tr:nth-child(even) {
  background: theme.$gray_1;
}

.channel-idx {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.comments-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.search-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  font-size: 13px;
  outline: none;

  &:focus {
    border-color: theme.$purple_1;
  }
}

.search-count {
  font-size: 12px;
  color: theme.$gray_4;
  white-space: nowrap;
}

.comments-list {
  max-height: 400px;
  overflow-y: auto;
}

:deep(.search-highlight) {
  background: #fff3b0;
  border-radius: 2px;
  padding: 0 1px;
}

.comment-row {
  display: flex;
  gap: 8px;
  padding: 4px 8px;
  border-bottom: 1px solid theme.$gray_0;
}

.comment-row:last-child {
  border-bottom: none;
}

.comment-time {
  flex-shrink: 0;
  width: 160px;
  font-variant-numeric: tabular-nums;
  color: theme.$gray_4;
  font-size: 12px;
}

.comment-text {
  color: theme.$gray_5;
  word-break: break-word;
}
</style>