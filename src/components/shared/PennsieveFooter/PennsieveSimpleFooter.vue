<template>
  <div class="bf-footer">
    <ul>
      <li>
        <a
          class="termsLink"
          href="https://docs.pennsieve.io/page/pennsieve-terms-of-use"
          target="_blank"
        >
          Terms
        </a>
      </li>
      <li>
        <a
          class="privacyLink"
          href="https://docs.pennsieve.io/page/privacy-policy"
          target="_blank"
        >
          Privacy
        </a>
      </li>
      <li class="copyrightInfo">
        &copy; {{ copyrightYear }} The University of Pennsylvania
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'PennsieveSimpleFooter',
  computed: {
    copyrightYear: function() {
      return new Date().getFullYear()
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../../../assets/_variables.scss';

.bf-footer {
  background: $white;
  display: block;
  font-size: 13px;
  padding: 0 0 20px 0;
  z-index: 2;
}

ul {
  display: flex;
  flex-direction: row;
  list-style: none;
  margin: 0;
  padding: 0;
}

li {
  margin-left: 5px;
}

li:first-child {
  margin-left: 0;
}

li:first-child:after {
  content: '+';
  display: inline-block;
  margin-left: 5px;
}

a {
  color: $gray_4;
}

a:hover {
  color: $primary-color;
}
</style>


