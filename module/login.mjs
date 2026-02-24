import { createElement, createInput, insertElement, insertNewElement, formatElement } from "./dom-helper.mjs";
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
    const wrapper = createElement("div", ["page-wrapper"]);
    const card = createElement("div", ["card"]);
    const form = createElement("form", ["login-form"]);

    insertElement(root, wrapper);
    insertElement(wrapper, card);
    insertNewElement(card, "h2", [], "Log in");
    insertElement(card, form);

    form.addEventListener("submit", handleLogin);

    const emailDiv = createElement("div", ["form-group"]);
    insertElement(form, emailDiv);
    insertNewElement(emailDiv, "label", [], "Email");
    createInput(emailDiv, "email", "login-email", "name@domain.com", required);

    const passDiv = createElement("div", ["form-group"]);
    insertElement(form, passDiv);
    insertNewElement(passDiv, "label", [], "Password");
    createInput(passDiv, "password", "login-password", "••••••••••••", required);

    const errorMsg = createElement("div", ["error-text"]);
    formatElement(errorMsg, {}, [], { id: "login-error" });
    insertElement(form, errorMsg);

    const btn = createElement("button", [], "Log in");
    formatElement(btn, {}, [], { type: "submit" });
    insertElement(form, btn);

    const forgotLink = createElement("p", ["forgot-password"]);
    insertElement(card, forgotLink);
    const forgotAnchor = createElement("a", [], "Forgot password?", "forgot-password-link");
    formatElement(forgotAnchor, {}, [], { href: "#" });
    insertElement(forgotLink, forgotAnchor);
    forgotAnchor.addEventListener("click", resetPassword);
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
        localStorage.setItem("currentUser", JSON.stringify({ email, role }));

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


