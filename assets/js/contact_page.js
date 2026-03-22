import { CONFIG } from "./config.js";

function joinUrl(base, path) {
  return `${String(base || "").replace(/\/+$/, "")}/${String(path || "").replace(/^\/+/, "")}`;
}

function byId(id) {
  return document.getElementById(id);
}

function clearErrors() {
  ["name", "email", "phone", "subject", "message"].forEach((key) => {
    const el = byId(`${key}_error`);
    if (el) el.textContent = "";
  });
}

function setError(field, message) {
  const el = byId(`${field}_error`);
  if (el) el.textContent = message;
}

function setResponse(message, isError = false) {
  const el = byId("contact-response-msg");
  if (!el) return;
  el.textContent = message || "";
  el.style.color = isError ? "#b00020" : "#198754";
}

function setLoading(isLoading) {
  const btn = byId("contact-submit-btn");
  const loading = byId("contact-loading");

  if (btn) btn.disabled = isLoading;
  if (loading) loading.style.display = isLoading ? "block" : "none";
}

function sanitizeSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function validateName(value) {
  const v = sanitizeSpaces(value);
  if (!v) return "Le nom est obligatoire.";
  if (v.length < 2) return "Le nom est trop court.";
  if (v.length > 100) return "Le nom est trop long.";
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(v)) return "Le nom contient des caractères invalides.";
  return "";
}

function validateEmail(value) {
  const v = sanitizeSpaces(value).toLowerCase();
  if (!v) return "L'email est obligatoire.";
  if (v.length > 254) return "L'email est trop long.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Le format de l'email est invalide.";
  return "";
}

function validatePhone(value) {
  const v = sanitizeSpaces(value);
  if (!v) return "";
  if (v.length > 30) return "Le numéro est trop long.";
  if (!/^[0-9+()./\- ]+$/.test(v)) return "Le numéro de téléphone est invalide.";
  return "";
}

function validateSubject(value) {
  const v = sanitizeSpaces(value);
  if (!v) return "L'objet est obligatoire.";
  if (v.length < 3) return "L'objet est trop court.";
  if (v.length > 150) return "L'objet est trop long.";
  return "";
}

function validateMessage(value) {
  const v = String(value || "").trim();
  if (!v) return "Le message est obligatoire.";
  if (v.length < 10) return "Le message est trop court.";
  if (v.length > 5000) return "Le message est trop long.";
  return "";
}

function getPayloadFromForm() {
  return {
    name: sanitizeSpaces(byId("ContactFormName")?.value || ""),
    email: sanitizeSpaces(byId("ContactFormEmail")?.value || "").toLowerCase(),
    phone: sanitizeSpaces(byId("ContactFormPhone")?.value || ""),
    subject: sanitizeSpaces(byId("ContactSubject")?.value || ""),
    message: String(byId("ContactFormMessage")?.value || "").trim(),
    website: String(byId("ContactWebsite")?.value || "").trim(),
  };
}

function validatePayload(payload) {
  const errors = {
    name: validateName(payload.name),
    email: validateEmail(payload.email),
    phone: validatePhone(payload.phone),
    subject: validateSubject(payload.subject),
    message: validateMessage(payload.message),
  };

  return {
    errors,
    isValid: !Object.values(errors).some(Boolean),
  };
}

async function submitContact(payload) {
  const url = joinUrl(CONFIG.API_BASE_URL, "/contact/messages");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text().catch(() => "");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const message = json?.error || json?.message || text || `${res.status} ${res.statusText}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = json || text;
    throw err;
  }

  return json;
}

function bindLiveValidation() {
  const mapping = {
    ContactFormName: ["name", validateName],
    ContactFormEmail: ["email", validateEmail],
    ContactFormPhone: ["phone", validatePhone],
    ContactSubject: ["subject", validateSubject],
    ContactFormMessage: ["message", validateMessage],
  };

  Object.entries(mapping).forEach(([inputId, [field, validator]]) => {
    const el = byId(inputId);
    if (!el) return;

    const run = () => {
      const message = validator(el.value);
      setError(field, message);
    };

    el.addEventListener("blur", run);
    el.addEventListener("input", run);
  });
}

function resetForm() {
  const form = byId("contact-form");
  if (form) form.reset();
  clearErrors();
}

async function handleSubmit(e) {
  e.preventDefault();
  setResponse("");
  clearErrors();

  const payload = getPayloadFromForm();

  // honeypot : on prétend succès pour les bots
  if (payload.website) {
    resetForm();
    setResponse("Votre message a bien été envoyé.");
    return;
  }

  const { errors, isValid } = validatePayload(payload);

  Object.entries(errors).forEach(([field, message]) => {
    if (message) setError(field, message);
  });

  if (!isValid) {
    setResponse("Merci de corriger les champs en erreur.", true);
    return;
  }

  setLoading(true);

  try {
    await submitContact(payload);
    resetForm();
    setResponse("Votre message a bien été envoyé. Nous vous répondrons dès que possible.");
  } catch (err) {
    setResponse(err?.message || "Une erreur est survenue lors de l'envoi du message.", true);
  } finally {
    setLoading(false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = byId("contact-form");
  if (!form) return;

  bindLiveValidation();
  form.addEventListener("submit", handleSubmit);
});