
<template>
  <div class="pdf-viewer">

    <vue-pdf-app style="height: 100vh;" :pdf="getFileUrl"></vue-pdf-app>
    
  </div>
</template>

<script>
import StaticViewer from '../../mixins/static-viewer'
// import VuePdfApp from "vue3-pdf-app";
// import this to use default icons for buttons
import "vue3-pdf-app/dist/icons/main.css";
import { defineAsyncComponent } from 'vue'

export default {
  name: 'PDFViewer',

  components: {

    'vue-pdf-app': defineAsyncComponent({
      // the loader function
      loader: () => import('vue3-pdf-app'),

      // A component to use while the async component is loading
      // loadingComponent: LoadingComponent,

      // Delay before showing the loading component. Default: 200ms.
      delay: 200,

      // A component to use if the load fails
      // errorComponent: ErrorComponent,

      // The error component will be displayed if a timeout is
      // provided and exceeded. Default: Infinity.
      timeout: 3000
    })


    // VuePdfApp
    // PDFWindow,
  },

  mixins: [
    StaticViewer
  ],

  data() {
    return {
      documentError: undefined,
      enableUploader: true
    }
  },

  methods: {
    /**
     * Updates current PDF url
     * @param {string} url
     */
    urlUpdated(url) {
      this.documentError = undefined
      this.url = url
    },
    /**
     * Logs error if something goes wrong with PDF document
     */
    onDocumentErrored(e) {
      this.documentError = e.text
    },
  },

}
</script>

<style scoped lang="scss">
  .pdf-viewer {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
    Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif !important;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #62637a;
    height: 100%;
    margin: 0;
    overflow: hidden;
    padding: 0;
    background-color: #606f7b;
  }
  label.form {
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
    Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif !important;
    font-weight: bold;
    margin-bottom: 2em;
    display: block;
  }
  input {
    padding: 0.45em;
    font-size: 1em;
  }
  .error {
    border: 1px solid red;
    background: pink;
    color: red;
    padding: 0.5em 3em;
    display: inline;
  }

  a.icon {
    cursor: pointer;
    display: block;
    border: 1px #333 solid;
    background: white;
    color: #333;
    font-weight: bold;
    padding: 0.25em;
    width: 1em;
    height: 1em;
    font-size: 1.5em;
  }
  .box-shadow {
    box-shadow: 0 15px 30px 0 rgba(0, 0, 0, 0.11), 0 5px 15px 0 rgba(0, 0, 0, 0.08);
  }
  .overflow-hidden {
    overflow: hidden;
  }

  @media print {
    body {
      background-color: transparent;
    }
    #app {
      margin: 0;
      padding: 0;
    }
  }
</style>

