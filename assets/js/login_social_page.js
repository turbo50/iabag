import { renderSocialButtons } from "./social_buttons.js";

console.log("✅ login_social_page.js chargé");

document.addEventListener("DOMContentLoaded", () => {
  renderSocialButtons("#social-auth-buttons", {
    nextUrl: "index.html",
  });
});