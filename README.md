# PennsieveApp

This template should help get you started developing with Vue 3 in Vite.

## Deployment Strategy

- __main__ branch reflects the version of the application that is in production. 
- __dev__ branch reflects a version of the application with features that are currently in development.<br><br>


- Create new feature branches off of __main__ branch
- Name feature branches `feature/descriptive-name`
- Name bug fix branches `fix/descriptive-name` 
- Merge branches into __dev__ branch to deploy to development environment
- Do not delete your feature branch until it is merged to production 
- Keep your feature branch up to date with __main__
- Merge feature branches into __main__ branch to deploy to production environment
- After a production deployment, an admin needs to update __dev__ environment by resetting it to be up to date with __main__. Developers with features currently merged to dev env but not yet deployed to production should be advised to merge their features back into dev if they need to continue testing them in dev environment. 
  - Navigate to `dev` branch in the terminal and run `git reset --hard origin/main`
  - `git push origin dev --force`



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
