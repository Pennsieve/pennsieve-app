<template>
  <div>
    <h1>{{ message }}</h1>
    <button @click="changeMessage">Change Message</button>
  </div>
</template>

<script>
export default {
  name: "BasicComponent",
  data() {
    return {
      message: "Hello, Vue!",
    };
  },
  methods: {
    changeMessage() {
      this.message = "You clicked the button!";
    },
  },
};
</script>

<style scoped>
h1 {
  color: #42b983;
}
button {
  background-color: #42b983;
  color: white;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
}
button:hover {
  background-color: #366f4c;
}
</style>
