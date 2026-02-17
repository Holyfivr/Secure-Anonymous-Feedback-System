import { createElement } from "./dom-helper.mjs";
const root = document.getElementById("root");

export function renderLandingPage() {
    root.innerHTML = ""; // Clear existing content
    renderNavBar();



}


function renderNavBar() {
    const nav = createElement(root, "nav", ["navbar"]);
    createElement(nav, "div", ["logo"], "S A F S");
    createElement(nav, "div", ["nav-links"], `
        <a href="#/home">Home</a>
        <a href="#/about">About</a>
        <a href="#/contact">Contact</a>
        <a href="#/login">Login</a>
    `);
}