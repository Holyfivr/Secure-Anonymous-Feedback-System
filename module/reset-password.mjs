import { createElement, insertElement, addNewElement, createInput } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
import { auth, verifyPasswordResetCode, confirmPasswordReset } from "./firebase-config.mjs";

const root = document.getElementById("root");

export async function renderResetPasswordPage(oobCode) {
    root.innerHTML = "";
    renderNavBar(root);

    const wrapper = createElement("div", ["page-wrapper"]);
    const card    = createElement("div", ["card"]);
    insertElement(root, wrapper);
    insertElement(wrapper, card);

    if (!oobCode) {
        addNewElement(card, "h2", [], "Invalid link");
        addNewElement(card, "p", ["error-text"], "This password reset link is invalid.");
        addLoginLink(card);
        return;
    }

    addNewElement(card, "h2", [], "Set new password");
    const statusEl = createElement("div", ["error-text"], "", "reset-status");
    insertElement(card, statusEl);
    statusEl.textContent = "Verifying link...";
    statusEl.classList.remove("error-text");

    try {
        const email = await verifyPasswordResetCode(auth, oobCode);
        statusEl.textContent = "";
        renderPasswordForm(card, oobCode, email);
    } catch {
        statusEl.classList.add("error-text");
        statusEl.textContent = "This link has expired or has already been used.";
        addLoginLink(card);
    }
}

function renderPasswordForm(card, oobCode, email) {
    const form       = createElement("form", ["login-form"]);
    const infoEl     = createElement("p", [], `Setting password for ${email}`);
    const passDiv    = createElement("div", ["form-group"]);
    const confirmDiv = createElement("div", ["form-group"]);
    const errorEl    = createElement("div", ["error-text"], "", "reset-error");
    const btn        = createElement("button", [], "Save password");

    insertElement(card, infoEl);
    insertElement(card, form);

    insertElement(form, passDiv);
    addNewElement(passDiv, "label", [], "New password");
    createInput(passDiv, "password", "reset-pass", "At least 6 characters", true);

    insertElement(form, confirmDiv);
    addNewElement(confirmDiv, "label", [], "Confirm password");
    createInput(confirmDiv, "password", "reset-pass-confirm", "Repeat password", true);

    insertElement(form, errorEl);
    btn.type = "submit";
    insertElement(form, btn);

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const pass    = document.getElementById("reset-pass").value;
        const confirm = document.getElementById("reset-pass-confirm").value;

        if (pass.length < 6) {
            errorEl.textContent = "Password must be at least 6 characters.";
            return;
        }
        if (pass !== confirm) {
            errorEl.textContent = "Passwords do not match.";
            return;
        }

        errorEl.textContent = "";
        btn.disabled = true;
        btn.textContent = "Saving...";

        try {
            await confirmPasswordReset(auth, oobCode, pass);
            card.innerHTML = "";
            addNewElement(card, "h2", [], "Password updated");
            const successEl = createElement("div", ["success-text"]);
            successEl.textContent = "Your password has been set. You can now log in.";
            insertElement(card, successEl);
            addLoginLink(card);
        } catch {
            btn.disabled = false;
            btn.textContent = "Save password";
            errorEl.textContent = "Could not save password. The link may have expired.";
        }
    });
}

function addLoginLink(parent) {
    const p = createElement("p", []);
    const a = createElement("a", [], "Go to login");
    a.href = "#/login";
    insertElement(p, a);
    insertElement(parent, p);
}
