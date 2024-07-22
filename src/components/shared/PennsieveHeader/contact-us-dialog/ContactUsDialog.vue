<template>
  <el-dialog class="contact-us-dialog" v-model="isOpen" @close="closeDialog">
    <template #header>
      <bf-dialog-header title="Contact Us" />
    </template>
    <dialog-body>
      <h2>Need to get in touch with the Pennsieve Support Team?</h2>
      <div class="flex-col">
        <div class="contact-method-container">
          <h3>Email Support</h3>
          <p>Contact us at support@pennsieve.io</p>
          <a href="mailto:support@pennsieve.io" target="_blank">
            Send email
            <IconArrowRight :height="12" :width="12" />
          </a>
        </div>
        <div class="contact-method-container">
          <h3>Office Hours</h3>
          <p>1 p.m. - 2 p.m. (EST) Every Monday</p>
          <a
            href="https://pennmedicine.zoom.us/j/91229384998?pwd=d2h3azZnR0UrRDlyeGo5akg4dzc5dz09"
            target="_blank"
          >
            Join on Zoom
            <IconArrowRight :height="12" :width="12" />
          </a>
        </div>
        <div class="contact-method-container">
          <h3>Learn More</h3>
          <p>Stay in touch with the Wagenaar Lab</p>
          <div class="flex-col">
            <a
              href="https://twitter.com/i/flow/login?redirect_after_login=%2Fwagenaarlab"
              target="_blank"
            >
              Visit Twitter
              <IconArrowRight :height="12" :width="12" />
            </a>
            <a
              href="https://wagenaarlab.org/"
              target="_blank"
              class="margin-top"
            >
              Visit Website
              <IconArrowRight :height="12" :width="12" />
            </a>
          </div>
        </div>
      </div>
    </dialog-body>
  </el-dialog>
</template>

<script>
import BfDialogHeader from "../../../shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "../../../shared/dialog-body/DialogBody.vue";
import Request from "../../../../mixins/request/index";
import { mapGetters } from "vuex";
import IconArrowRight from "../../../icons/IconArrowRight.vue";
import EventBus from "../../../../utils/event-bus";

export default {
  name: "ContactUsDialog",
  components: {
    BfDialogHeader,
    DialogBody,
  },
  mixins: [Request],
  props: {
    selectedFiles: {
      type: Array,
      default: () => {},
    },
  },
  data: function () {
    return {
      options: [],
      value: "",
      selectedApplication: {},
      isLoading: false,
      isOpen: false,
    };
  },
  computed: {
    ...mapGetters([
      "userToken",
      "config",
      "dataset",
      "activeOrganization",
      "userToken",
    ]),
  },
  watch: {
    /**
     * Watch file
     */
  },
  mounted() {
    EventBus.$on("isContactUsDialogOpen", (data) => {
      this.isOpen = data;
    });
  },
  methods: {
    /**
     * Closes the dialog
     */
    closeDialog: function () {
      this.isOpen = false;
    },
  },
};
</script>
<style lang="scss">
  .contact-us-dialog{
    width:540px;
    padding:0;
  }
</style>
<style scoped lang="scss">
@import "../../../../assets/_variables.scss";

.margin-top {
  margin-top: 10px;
}
.flex-col {
  display: flex;
  flex-direction: column;
}
.flex-row {
  display: flex;
  flex-direction: row;
}
.dialog-heading {
  margin: 20px 0px;
  font-size: 18px;
  color: #928d85;
}
.svg-icon {
  color: $app-primary-color;
}
.flex {
  display: flex;
  justify-content: center;
}
.box {
  margin: 10px;
  height: 250px;
}
a {
  color: #3a26cb;
}
.contact-method-container {
  margin: 5px;
}
.center {
  text-align: center;
}
</style>
