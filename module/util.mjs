import { auth, sendPasswordResetEmail } from "./firebase-config.mjs";


export async function resetPassword(e) {
    e.preventDefault();

    const email     = document.getElementById("login-email").value;
    const errorEl   = document.getElementById("login-error");

    if (!email) {
        errorEl.textContent = "Enter your email first.";
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        errorEl.classList.remove("error-text");
        errorEl.classList.add("success-text");
        errorEl.textContent = "Password reset email sent! Check your inbox or spam folder. Note that it may take several minutes for the mail to arrive.";
        errorEl.style.fontWeight = "bold";
    } catch (err) {
        errorEl.classList.remove("success-text");
        errorEl.classList.add("error-text");
        errorEl.textContent = "Could not send reset email. Check the address.";
    }
}


export function redirectIfLoggedIn() {
    const loggedInUser = localStorage.getItem("currentUser");
    if (loggedInUser) {
        const user = JSON.parse(loggedInUser);
        if (window.location.hash === "#/login") {
            if      (user.role === "superadmin")    window.location.hash = "#/superadmin";
            else if (user.role === "schooladmin")   window.location.hash = "#/schooladmin";
            else if (user.role === "classadmin")    window.location.hash = "#/classadmin";
        }
    }
}