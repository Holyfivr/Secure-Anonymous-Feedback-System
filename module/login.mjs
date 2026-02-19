import { createElement, createInput } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
import { auth, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "./firebase-config.mjs";
const root = document.getElementById("root");
const required = true;

export function renderLoginPage() {
    root.innerHTML = "";
    renderNavBar(root);
    renderLoginForm();
}

function renderLoginForm() {
    const wrapper = createElement(root, "div", ["page-wrapper"]);
    const card = createElement(wrapper, "div", ["card"]);

    createElement(card, "h2", [], "Log in");

    const form = createElement(card, "form", ["login-form"]);
    form.addEventListener("submit", handleLogin);

    const emailDiv = createElement(form, "div", ["form-group"]);
    createElement(emailDiv, "label", [], "Email");
    createInput(emailDiv, "email", "login-email", "name@domain.com", required);

    const passDiv = createElement(form, "div", ["form-group"]);
    createElement(passDiv, "label", [], "Password");
    createInput(passDiv, "password", "login-password", "••••••••••••", required);

    const errorMsg = createElement(form, "div", ["error-text"]);
    errorMsg.id = "login-error";

    const btn = createElement(form, "button", [], "Log in");
    btn.type = "submit";

    const forgotLink = createElement(card, "p", ["forgot-password"]);
    forgotLink.innerHTML = `<a href="#" id="forgot-password-link">Forgot password?</a>`;
    forgotLink.querySelector("a").addEventListener("click", handleForgotPassword);
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const errorEl = document.getElementById("login-error");

    if (!email || !password) {
        errorEl.textContent = "Please enter a valid email/password.";
        return;
    }

    errorEl.textContent = "";

    try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const token = await credential.user.getIdTokenResult(true);
        const role = token.claims.role;

        if (role === "superadmin") window.location.hash = "#/superadmin";
        else if (role === "schooladmin") window.location.hash = "#/schooladmin";
        else if (role === "classadmin") window.location.hash = "#/classadmin";
        else {
            errorEl.textContent = "No role assigned to this account.";
            await signOut(auth);
        }
    } catch (err) {
        errorEl.textContent = "Wrong email or password.";
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const errorEl = document.getElementById("login-error");

    if (!email) {
        errorEl.textContent = "Enter your email first.";
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        errorEl.classList.remove("error-text");
        errorEl.classList.add("success-text");
        errorEl.textContent = "Password reset email sent! Check your inbox or spam folder.";
    } catch (err) {
        errorEl.classList.remove("success-text");
        errorEl.classList.add("error-text");
        errorEl.textContent = "Could not send reset email. Check the address.";
    }
}
