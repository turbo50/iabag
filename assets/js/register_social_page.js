import { renderSocialButtons } from "./social_buttons.js";
import { CONFIG } from "./config.js";

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return {};
  }
}

// Handler à appeler après succès social auth
async function onAuthSuccess(idToken, user) {
  // user = infos COGNITO (structure à adapter)
  const pseudoInput = document.getElementById("reg-pseudo");
  const pseudo = pseudoInput?.value?.trim() || "";

  if (!pseudo) {
    alert("Veuillez fournir un pseudo !");
    if (pseudoInput) pseudoInput.focus();
    return;
  }

  // Récupérer le sub Cognito (code_client)
  let code_client = user?.sub;
  if (!code_client && idToken) code_client = parseJwt(idToken).sub;

  if (!code_client) {
    alert("Erreur technique : Code client Cognito introuvable !");
    return;
  }

  // Enregistre dans la table DynamoDB via l’API backend
  try {
    await fetch(CONFIG.API_BASE_URL + "/clients/me/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + idToken
      },
      body: JSON.stringify({ pseudo, code_client })
    });
    // Option : afficher un succès ou rediriger
    window.location.href = "index.html";
  } catch (err) {
    alert("Erreur lors de l'enregistrement du pseudo. Veuillez réessayer !");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Ajoute le handler de succès (nécessite patch dans social_buttons.js)
  renderSocialButtons("#social-auth-buttons", {
    nextUrl: "index.html",
    onAuthSuccess
  });
});