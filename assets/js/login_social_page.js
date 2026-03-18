import { renderSocialButtons } from "./social_buttons.js";

document.addEventListener("DOMContentLoaded", () => {
  renderSocialButtons("#social-auth-buttons", { nextUrl: "index.html" });
});