import { createElement, insertElement, addNewElement, formatElement } from "./dom-helper.mjs";
import { signOut, auth } from "./firebase-config.mjs";
const root = document.getElementById("root");

export function renderLandingPage() {
  root.innerHTML = "";
  renderNavBar(root);
}

const navLinks = [
    { href: "#/home"    , text: "Home" },
    { href: "#/privacy" , text: "Privacy" },
    { href: "#/feedback", text: "Send feedback" },
];

export function renderNavBar(parent) {
  const nav         = createElement("nav", ["navbar"]);
  const navBar      = createElement("div", ["nav-links"]);

  insertElement     (parent, nav);
  addNewElement     (nav, "div", ["logo"], "S A F S");
  insertElement     (nav, navBar);

  navLinks.forEach  ((link) => {
    const anchor    = createElement("a", [], link.text);
    formatElement   (anchor, {}, [], { href: link.href });
    insertElement   (navBar, anchor);
  });

  // Checks if user is logged in and renders appropriate buttons
  const loggedIn    = localStorage.getItem("currentUser");
  if (loggedIn) {
    const logoutBtn     = createElement("a", ["btn-danger"], "Log out");
    const dashboardBtn  = createElement("a", [], "Dashboard");
    insertElement       (navBar, dashboardBtn);
    insertElement       (navBar, logoutBtn);
    addDashboardButton  (dashboardBtn);
    addLogoutButton     (logoutBtn);
  } else {
    const loginBtn      = createElement("a", [], "Log in");
    formatElement       (loginBtn, {}, [], { href: "#/login" });
    insertElement       (navBar, loginBtn);
  }
  return nav;
}

/* Adds logout functionality to the provided button. When clicked, it signs the user out using Firebase Authentication, removes the current user from local storage, and redirects to the login page.*/
export async function addLogoutButton(btn) {
  btn.href = "#/login";
  btn.addEventListener("click", async () => {
      await signOut(auth);
      localStorage.removeItem("currentUser");
      window.location.hash = "#/login";
  });
}

/* Adds dashboard button functionality to the provided button. When clicked, it redirects the user to the dashboard page. 
   Since the dashboard page and the login page are functionally the same, it just redirects to login. */
export function addDashboardButton(btn) {
  btn.href = "#/login";
  btn.addEventListener("click", () => {
    window.location.hash = "#/login";
  });
}


