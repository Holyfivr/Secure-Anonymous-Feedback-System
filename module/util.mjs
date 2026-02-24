import { auth, sendPasswordResetEmail } from "./firebase-config.mjs";


export async function resetPassword(e) {
    e.preventDefault();

    const error                 = document.getElementById("login-error");
    if (!error) return;

    let email                   = auth.currentUser?.email || "";

    if (!email) {
        const emailInput        = document.getElementById("login-email");
        email                   = emailInput?.value.trim() || "";
    }

    if (!email) {
        error.classList.remove  ("success-text");
        error.classList.add     ("error-text");
        error.textContent       = "Enter your email first.";
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        error.classList.remove  ("error-text");
        error.classList.add     ("success-text");
        error.textContent       = "Password reset email sent! Check your inbox or spam folder. Note that it may take several minutes for the mail to arrive.";
        error.style.fontWeight  = "bold";
    } catch (err) {
        error.classList.remove  ("success-text");
        error.classList.add     ("error-text");
        error.textContent       = "Could not send reset email. Check the address.";
    }
}

export function redirectIfLoggedIn() {
    const loggedInUser = localStorage.getItem("currentUser");
    if (loggedInUser) {
        const user = JSON.parse(loggedInUser);
        if (window.location.hash === "#/login") {
            if        (user.role === "superadmin")    window.location.hash = "#/superadmin";
            else if   (user.role === "schooladmin")   window.location.hash = "#/schooladmin";
            else if   (user.role === "classadmin")    window.location.hash = "#/classadmin";
        }
    }
}