import { createElement } from "./dom-helper.mjs";
import { signOut, auth } from "./firebase-config.mjs";
const root = document.getElementById("root");

export function renderLandingPage() {
  root.innerHTML = "";
  renderNavBar(root);
}

const navLinks = `
        <a href="#/home">Home</a>
        <a href="#/feedback">Send feedback</a>
        `;

export function renderNavBar(parent, loggedIn) {
  const nav = createElement(parent, "nav", ["navbar"]);
  createElement(nav, "div", ["logo"], "S A F S");
  const navBar = createElement(nav, "div", ["nav-links"]);
  if (loggedIn) {
    navBar.innerHTML = `
        ${navLinks}
        ${createElement(navBar, "a", ["btn-danger"], "Log out").outerHTML}
    `;

    const logoutBtn = navBar.querySelector("a.btn-danger");
    addLogoutButton(logoutBtn)

  } else {
  navBar.innerHTML = `
        ${navLinks}
        <a href="#/login">Log in</a>
    `;
    }
  return nav;
}



export async function addLogoutButton(btn) {
    btn.href = "#/login";
    btn.addEventListener("click", async () => {
        await signOut(auth);
        window.location.hash = "#/login";
    });
}