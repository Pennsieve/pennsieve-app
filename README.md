# Pennsieve App

New and improved Pennsieve web app, now leveraging Vue 3!

## Contributing (Branching and Deployment)

- **main** branch deploys to our production environment on merge. https://app.pennsieve.io/

- **dev** branch deploys to our non-prod environment on merge. Merge branches to `dev` for testing. https://app.pennsieve.net/

### Feature Branches

- Always branch off on `main` when starting a new feature, bug or epic. `git checkout -b feature_my-cool-feature`

- The exception is for epic branches, where you will branch off the epic to create your feature branch.

- Please do not branch off of `dev` or merge `dev` into your feature branch. `dev` often contains features that are not ready for release, and polluting your branch with dev requires us to cherry pick out unreleased features, which may delay your release.

#### Branch Naming Convention

- Feature branches: `feature_descriptive-name`
- Bug fix branches: `fix_descriptive-name`
- Epic branches: `epic_descriptive-name`

- Once your feature branch has been merged to `main` please delete it.

### Deploy for Testing to Non-Prod Environment

- Merge branches into `dev` branch to deploy to non-prod environment.

- Do not delete your feature branch until it is merged to production.

- Keep your feature branch up to date with `main`.

### Deploy for Relase to Production Environment

- Make a PR from your feature branch into `main`

- Merge your code into `main` locally and test it locally.

- Once approved, merge feature branches into main branch to automatically deploy to production environment.

- When deploying to production, please create a corresponding [Release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository). Use [Semantic Versioning](https://semver.org/) convention for tagging and titling Releases.

### Reset Non-Prod

- Contact an admin to reset `dev` if you need to test a feature in isolation from other in-progress features.

#### Commands to Rest Non-Prod

- Navigate to `main` branch in the terminal and run `git pull origin main`

- Navigate to `dev` branch in the terminal and run `git reset --hard origin/main`

- Force push dev branch: `git push origin dev --force`. This will trigger a new build of `dev` to be deployed to non-prod environment.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin)

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/)

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
We use [msw](https://mswjs.io/) for mocking APIs in tests.
We use [test-utils](https://test-utils.vuejs.org/) for unit testing.

The mock API can be found in `/src/test/mocks`
For an example using the mock API look here: `/src/mixins/request/request.spec.js`

```sh
npm run test
```
