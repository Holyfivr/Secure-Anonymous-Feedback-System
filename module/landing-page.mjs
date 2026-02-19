import { createElement } from "./dom-helper.mjs";
const root = document.getElementById("root");

export function renderLandingPage() {
    root.innerHTML = "";
    renderNavBar(root);
}

export function renderNavBar(parent) {
    const nav = createElement(parent, "nav", ["navbar"]);
    createElement(nav, "div", ["logo"], "S A F S");
    createElement(nav, "div", ["nav-links"], `
        <a href="#/home">Home</a>
        <a href="#/feedback">Send feedback</a>
        <a href="#/login">Log in</a>
    `);
    return nav;
}