import { renderLandingPage } from "./landing-page.mjs";
import { renderLoginPage } from "./login.mjs";
import { renderSuperadminPage } from "./superadmin.mjs";
import { renderSchooladminPage } from "./schooladmin.mjs";
import { renderClassadminPage } from "./classadmin.mjs";
import { renderPrivacyPage } from "./privacy-policy.mjs";
import { renderFeedbackPage, renderFeedbackForm } from "./feedback-form.mjs";
import { renderResetPasswordPage } from "./reset-password.mjs";

const routes = {
    "/home": renderLandingPage,
    "/login": renderLoginPage,
    "/superadmin": renderSuperadminPage,
    "/schooladmin": renderSchooladminPage,
    "/classadmin": renderClassadminPage,
    "/feedback": renderFeedbackPage,
    "/privacy": renderPrivacyPage,
};

function handleAuthAction() {
    const params  = new URLSearchParams(window.location.search);
    const mode    = params.get("mode");
    const oobCode = params.get("oobCode");

    if (mode === "resetPassword" && oobCode) {
        window.history.replaceState(null, "", window.location.pathname);
        renderResetPasswordPage(oobCode);
        return true;
    }
    return false;
}

function navigate() {
    const hash = window.location.hash.slice(1) || "/home";

    const feedbackMatch = hash.match(/^\/feedback\/([^/]+)\/([^/]+)$/);
    if (feedbackMatch) {
        renderFeedbackForm(feedbackMatch[1], feedbackMatch[2]);
        return;
    }

    const renderFn = routes[hash];
    if (renderFn) {
        renderFn();
    } else {
        renderLandingPage();
    }
}

window.addEventListener("hashchange", navigate);

if (!handleAuthAction()) {
    navigate();
}
