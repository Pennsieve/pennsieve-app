# Pennsieve App

New and improved Pennsieve web app, now leveraging Vue3 .

## Contributing to this Repo (Branching and Deployment)

- **main** branch reflects the version of the application that is in production.
- **dev** branch reflects a version of the application with features that are currently in development.<br><br>

### Create new feature branches off of main branch

- Name feature branches `feature_descriptive-name`
- Name bug fix branches `fix_descriptive-name`

### When you are ready to test your code in a non-prod/ development environment

- Merge branches into `dev` branch to deploy to non-prod/ development environment https://app.pennsieve.net/ - we only have one non-prod/ development environment at this time.
- NOTE: Do not delete your feature branch until it is merged to production
- Keep your feature branch up to date with `main.`

### When you are ready to deploy your code to production

- Make a PR from your feature branch into `main.`
- It is a good idea to test this locally first before making your PR. Merge your code into `main` locally and test it locally.
- You will need one approval to merge your code to `main`. Once you merge, it will automatically deploy to production https://app.pennsieve.io/
- If you need to wait to deploy after PR approval, add a label to your PR `Do not merge` and another label describing why, such as `BE Dependency` or `Waiting for PM Approval` until you are ready to deploy, and then remove the labels. You can add a `Ready to Deploy` label to indicate it is ready to go out if you are waiting for someone else to deploy it, but feel free to merge it yourself if it is ready to go out, there is no formal process preventing any developer from deploying.
- Merge feature branches into main branch to deploy to production environment.
- When deploying to production, please create a corresponding Release in github (Managing Releases in A Repository). Each release PR should be titled with it's release number using the Semantic Versioning convention (v1.0.0).

### Resetting the Development Environment to match Production

- If `dev` is missing features that were deployed to `main`, or for any other reason you need a development environment equivalent to production for testing, without other in-development features an admin needs to update `dev` environment by resetting it to be up to date with main. Developers with features currently merged to `dev` but not yet merged to `main` should be advised to merge their features back into `dev `if they need to continue testing them in `dev` environment.

#### To Reset the development to be equivalent to the production enviornment

- Navigate to `dev` branch in the terminal and run git reset --hard origin/main
- Force push `dev branch git push origin dev --force` This will trigger a new build of the `dev `branch to be deployed to the `dev` environment.

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

The mock API can be found in `/src/test/mocks`
For an example using the mock API look here: `/src/mixins/request/request.spec.js`

```sh
npm run test
```
