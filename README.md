# PennsieveApp

This template should help get you started developing with Vue 3 in Vite..

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin).

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

Install Node.js version 18.17.1 using:
```sh
nvm install 18.17.1
nvm use 18.17.1
```

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## Testing

We use [Vitest](https://vitest.dev/) library for unit testing components.
We use [msw](https://mswjs.io/) for mocking APIs in tests
We use [test-utils](https://test-utils.vuejs.org/) for unit testing.

The mock API can be found in ```/src/test/mocks```
For an example using the mock API look here: ```/src/mixins/request/request.spec.js```


``` sh
npm run test 
```