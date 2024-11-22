import * as config from '@/site-config/site.json'

const awsConfig = {
  Auth: {
    Cognito:{
      userPoolClientId: config.awsConfig.userPoolWebClientId,
      userPoolId: config.awsConfig.userPoolId,
      loginWith: {
        email: "true",
        oauth: {
          domain: config.awsConfig.oauth.domain,
          scope: config.awsConfig.oauth.scope,
          redirectSignIn: config.awsConfig.oauth.redirectSignIn,
          redirectSignOut: config.awsConfig.oauth.redirectSignOut,
          responseType: config.awsConfig.oauth.responseType,
        }
      },
      username: 'true'
    }
  }
}
export default awsConfig
