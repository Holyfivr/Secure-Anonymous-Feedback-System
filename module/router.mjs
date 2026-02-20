import { renderLandingPage } from "./landing-page.mjs";
import { renderLoginPage } from "./login.mjs";
import { renderSuperadminPage } from "./superadmin.mjs";
import { renderSchooladminPage } from "./schooladmin.mjs";
import { renderFeedbackPage, renderFeedbackForm } from "./feedback-form.mjs";

const routes = {
    "/home": renderLandingPage,
    "/login": renderLoginPage,
    "/superadmin": renderSuperadminPage,
    "/schooladmin": renderSchooladminPage,
    "/feedback": renderFeedbackPage,
};

function navigate() {
    const hash = window.location.hash.slice(1) || "/home"; // remove '#'

    // Check for dynamic feedback route: /feedback/schoolId/classId
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
navigate(); // Initial render