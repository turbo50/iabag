export const COGNITO_OAUTH = {
  // Ex: https://iabag-prod.auth.eu-west-3.amazoncognito.com
  domain: "https://eu-west-3on7woguxg.auth.eu-west-3.amazoncognito.com",
  clientId: "637p10ibkt5a7k2l238d686akf",

  // fonctionne sur iabag.fr et iabag.com (tu configures les 2 dans Cognito)
  redirectUri: `${window.location.origin}/auth-callback.html`,
  logoutUri: `${window.location.origin}/login.html`,

  scopes: ["openid", "email", "profile"],

  /**
   * Tu peux ajouter facilement d’autres providers ensuite :
   * facebook: { label: "Continuer avec Facebook", cognitoName: "Facebook" }
   */
  providers: {
    google: { label: "Continuer avec Google", cognitoName: "Google", enabled: true },

    // prêt pour plus tard (tu mets enabled: true quand Cognito est prêt)
    facebook: { label: "Continuer avec Facebook", cognitoName: "Facebook", enabled: true },
    apple: { label: "Continuer avec Apple", cognitoName: "SignInWithApple", enabled: true },
  },
};