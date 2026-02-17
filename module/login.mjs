import { createElement, createInput } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
const root = document.getElementById("root");

export function renderLoginPage() {
    root.innerHTML = "";
    renderNavBar(root);
    renderLoginForm();
}

function renderLoginForm() {
    const wrapper = createElement(root, "div", ["login-wrapper"]);
    const card = createElement(wrapper, "div", ["login-card"]);

    createElement(card, "h2", [], "Log in");

    const form = createElement(card, "form", ["login-form"]);
    form.addEventListener("submit", handleLogin);

    const emailDiv = createElement(form, "div", ["form-group"]);
    createElement(emailDiv, "label", [], "Email");
    createInput(emailDiv, "email", "login-email", "name@domain.com");

    const passDiv = createElement(form, "div", ["form-group"]);
    createElement(passDiv, "label", [], "Password");
    createInput(passDiv, "password", "login-password", "••••••••••••");

    const errorMsg = createElement(form, "div", ["login-error"]);
    errorMsg.id = "login-error";

    const btn = createElement(form, "button", ["login-btn"], "Log in");
    btn.type = "submit";
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const errorEl = document.getElementById("login-error");

    if (!email || !password) {
        errorEl.textContent = "Please enter a valid email/password.";
        return;
    }

    errorEl.textContent = "";

    // TODO: Firebase Auth – signInWithEmailAndPassword
    // After login, read custom claims to determine role and route:
    //   superadmin  → #/superadmin
    //   schooladmin → #/schooladmin
    //   classadmin  → #/classadmin
    console.log("Login attempt:", email);
}
