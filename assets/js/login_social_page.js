import { renderSocialButtons } from "./social_buttons.js";
import { isAuthenticated, getUserFromIdToken, logout } from "./auth_social_cognito.js";

function renderUser() {
  const box = document.getElementById("logged-box");
  const pre = document.getElementById("user-info");
  if (!box || !pre) return;

  if (!isAuthenticated()) {
    box.style.display = "none";
    return;
  }

  const user = getUserFromIdToken();
  box.style.display = "";
  pre.textContent = JSON.stringify(
    {
      email: user?.email,
      name: user?.name,
      given_name: user?.given_name,
      family_name: user?.family_name,
      sub: user?.sub,
    },
    null,
    2
  );
}

document.addEventListener("DOMContentLoaded", () => {
  renderSocialButtons("#social-auth-buttons", { nextUrl: "checkout-style1.html" });

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  renderUser();
  window.addEventListener("auth:changed", renderUser);
});