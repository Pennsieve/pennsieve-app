import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import striptags from 'striptags';

// import "./assets/element-variables.scss";
// import "./assets/_svg-icon.scss";

import Amplify from '@aws-amplify/core'
import AWSConfig from '@/utils/aws-exports.js'
import {ElMessage} from 'element-plus'

Amplify.configure(AWSConfig)

const app = createApp(App);

app.config.globalProperties.$sanitize = (html, allowedTags=['br']) => striptags(html, allowedTags)
app.config.globalProperties.$message = ElMessage;

app.use(store);

app.use(router);

app.mount("#app");