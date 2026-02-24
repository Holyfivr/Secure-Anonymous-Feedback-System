import { createElement, insertElement, addNewElement, formatElement } from "./dom-helper.mjs";
import { signOut, auth } from "./firebase-config.mjs";
const root = document.getElementById("root");

export function renderLandingPage() {
  root.innerHTML = "";
  renderNavBar(root);
}

const navLinks = [
    { href: "#/home", text: "Home" },
    { href: "#/privacy", text: "Privacy" },
    { href: "#/feedback", text: "Send feedback" },
];

export function renderNavBar(parent, loggedIn) {
  const nav = createElement("nav", ["navbar"]);
  insertElement(parent, nav);
  addNewElement(nav, "div", ["logo"], "S A F S");

  const navBar = createElement("div", ["nav-links"]);
  insertElement(nav, navBar);

  navLinks.forEach((link) => {
    const anchor = createElement("a", [], link.text);
    formatElement(anchor, {}, [], { href: link.href });
    insertElement(navBar, anchor);
  });

  if (loggedIn) {
    const logoutBtn = createElement("a", ["btn-danger"], "Log out");
    insertElement(navBar, logoutBtn);
    addLogoutButton(logoutBtn);
  } else {
    const loginBtn = createElement("a", [], "Log in");
    formatElement(loginBtn, {}, [], { href: "#/login" });
    insertElement(navBar, loginBtn);
  }
  return nav;
}



export async function addLogoutButton(btn) {
    btn.href = "#/login";
    btn.addEventListener("click", async () => {
        await signOut(auth);
        localStorage.removeItem("currentUser");
        window.location.hash = "#/login";
    });
}