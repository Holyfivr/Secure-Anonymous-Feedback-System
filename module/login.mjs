import { createElement, createInput, insertElement, addNewElement, formatElement } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
import { auth, signInWithEmailAndPassword, signOut } from "./firebase-config.mjs";
import { resetPassword, redirectIfLoggedIn } from "./util.mjs";
const root = document.getElementById("root");
const required = true;

export function renderLoginPage() {
    redirectIfLoggedIn();
    root.innerHTML = "";
    renderNavBar(root);
    renderLoginForm();
}

function renderLoginForm() {
    const wrapper       = createElement("div", ["page-wrapper"]);
    const card          = createElement("div", ["card"]);
    const form          = createElement("form", ["login-form"]);
    const emailDiv      = createElement("div", ["form-group"]);
    const passDiv       = createElement("div", ["form-group"]);
    const errorMsg      = createElement("div", ["error-text"]);
    const btn           = createElement("button", [], "Log in");
    const forgotLink    = createElement("p", ["forgot-password"]);
    const forgotAnchor  = createElement("a", [], "Forgot password?", "forgot-password-link");

    /* Renders the login form container */
    insertElement       (root, wrapper);
    insertElement       (wrapper, card);
    addNewElement       (card, "h2", [], "Log in");
    insertElement       (card, form);

    /* Handles form submission for logging in. */
    form.addEventListener("submit", handleLogin);

    /* Renders email input field with label */
    insertElement       (form, emailDiv);
    addNewElement       (emailDiv, "label", [], "Email");
    createInput         (emailDiv, "email", "login-email", "name@domain.com", required);

    /* Renders password input field with label */
    insertElement       (form, passDiv);
    addNewElement       (passDiv, "label", [], "Password");
    createInput         (passDiv, "password", "login-password", "••••••••••••", required);

    /* Renders error message container */
    formatElement       (errorMsg, {}, [], { id: "login-error" });
    insertElement       (form, errorMsg);

    /* Renders login button */
    formatElement       (btn, {}, [], { type: "submit" });
    insertElement       (form, btn);

    /* Renders forgot password link */
    insertElement       (card, forgotLink);
    formatElement       (forgotAnchor, {}, [], { href: "#" });
    insertElement       (forgotLink, forgotAnchor);

    forgotAnchor.addEventListener("click", resetPassword);
}

async function handleLogin(e) {
    e.preventDefault();
    const email         = document.getElementById("login-email").value;
    const password      = document.getElementById("login-password").value;
    const errorEl       = document.getElementById("login-error");

    if (!email || !password) {
        errorEl.textContent = "Please enter a valid email/password.";
        return;
    }

    errorEl.textContent = "";

    try {
        const credential    = await signInWithEmailAndPassword(auth, email, password);
        const token         = await credential.user.getIdTokenResult(true);
        const role          = token.claims.role;

        localStorage.setItem("currentUser", JSON.stringify({ email, role }));

        if      (role === "superadmin")     window.location.hash = "#/superadmin";
        else if (role === "schooladmin")    window.location.hash = "#/schooladmin";
        else if (role === "classadmin")     window.location.hash = "#/classadmin";
        else {
            errorEl.textContent = "No role assigned to this account.";
            await signOut(auth);
        }
    } catch (err) {
        errorEl.textContent = "Wrong email or password.";
    }
}


