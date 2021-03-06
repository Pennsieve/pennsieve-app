import ElementUI from 'element-ui';
import { createLocalVue, mount } from 'vue-test-utils'

import ResetPassword from './ResetPassword.vue'

const localVue = createLocalVue()
localVue.use(ElementUI)

const $route = {
  path: "/password",
  query: {
    verificationCode: "$134322"
  },
  params: {},
  fullPath: "/password?verificationCode=%24134322&email=cameron%2Bcognito%2Buser%40blackfynn.com",
  name: "password",
  meta: {}
}

describe('ResetPassword.vue', () => {
  let cmp

  beforeEach(() => {
    cmp = mount(ResetPassword, {
      localVue,
      mocks: {
        $route
      }
    })
  })

  it('Verification code is displayed in the input', () => {
    const inputEmail = cmp.vm.$refs.passwordFormCode
    expect(inputEmail.value).toBe('$134322')
  })
})
