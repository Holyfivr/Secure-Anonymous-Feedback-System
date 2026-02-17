import { renderLandingPage } from "./landing-page.mjs";
import { renderLoginPage } from "./login.mjs";

const routes = {
    "/home": renderLandingPage,
    "/login": renderLoginPage,
};

function navigate() {
    const hash = window.location.hash.slice(1) || "/home"; // remove '#'
    const renderFn = routes[hash];
    if (renderFn) {
        renderFn();
    } else {
        renderLandingPage();
    }
}

window.addEventListener("hashchange", navigate);
navigate(); // Initial render