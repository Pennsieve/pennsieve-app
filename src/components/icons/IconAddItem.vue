<template>
  <svg
    id="create-button-icon"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <defs>
      <linearGradient
        id="create_icon_gradient"
        x1="15.9987"
        y1="5.0012"
        x2="21.9987"
        y2="5.0012"
        gradientUnits="userSpaceOnUse"
      >
        <stop
          offset="0.0161"
          stop-color="#fff"
          stop-opacity="0.2"
        /><stop
        offset="0.322"
        stop-color="#f2f3f4"
        stop-opacity="0.1875"
      /><stop
        offset="0.5772"
        stop-color="#cacdd1"
        stop-opacity="0.1487"
      /><stop
        offset="0.8134"
        stop-color="#878d96"
        stop-opacity="0.0836"
      /><stop
        offset="1"
        stop-color="#3b4554"
        stop-opacity="0.01"
      />
      </linearGradient>
    </defs><g id="document">
    <polygon
      points="21.999 22.001 1.999 22.001 1.999 2.001 15.999 2.001 21.999 7.97 21.999 22.001"
      fill="#dadada"
    /><path
    d="M15.9987,2.0012v4.5a1.5,1.5,0,0,0,1.5,1.5h4.5Z"
    fill="#71747c"
  /><g
    id="_generic_"
    data-name="&lt;generic&gt;"
  >
    <g
      id="_artwork_"
      data-name="&lt;artwork&gt;"
    >
      <polygon
        points="21.999 22.001 1.999 22.001 1.999 2.001 15.999 2.001 21.999 7.97 21.999 22.001"
        fill="#dadada"
      /><path
      d="M15.9987,2.0012v4.5a1.5,1.5,0,0,0,1.5,1.5h4.5Z"
      fill="#71747c"
    />
    </g><path
    id="_gradient_"
    data-name="&lt;gradient&gt;"
    d="M15.9987,2.0012v4.5a1.5,1.5,0,0,0,1.5,1.5h4.5Z"
    fill="url(#create_icon_gradient)"
  />
  </g>
  </g><g id="plus-sign">
    <path
      d="M15.9987,11.0012h-3v-3a1,1,0,0,0-2,0v3h-3a1,1,0,1,0,0,2h3v3a1,1,0,0,0,2,0v-3h3a1,1,0,0,0,0-2Z"
      fill="currentColor"
    />
  </g>
  </svg>
</template>

<script>
export default {
  name: "IconAddItem",
  props: {
    width: {
      type: Number,
      default: 16,
    },
    height: {
      type: Number,
      default: 16,
    },
    color: {
      type: String,
      default: "currentColor",
    },
  },
};
</script>
