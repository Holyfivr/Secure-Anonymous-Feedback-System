import { createElement, insertElement, addNewElement, formatElement } from "./dom-helper.mjs";
import { signOut, auth } from "./firebase-config.mjs";
const root = document.getElementById("root");
const landingContentPath = "./docs/landing-page.json";

export async function renderLandingPage() {
  root.innerHTML = "";
  renderNavBar(root);

  const wrapper = createElement("div", ["page-wrapper"]);
  const card = createElement("section", ["privacy-card", "landing-card"]);
  const content = createElement("article", ["landing-content"]);

  insertElement(root, wrapper);
  insertElement(wrapper, card);
  insertElement(card, content);

  try {
    const response = await fetch(landingContentPath);
    if (!response.ok) {
      throw new Error(`Could not load ${landingContentPath}`);
    }

    const landingData = await response.json();
    renderLandingContent(content, landingData);
  } catch {
    addNewElement(content, "h2", ["centered"], "Welcome to SAFS");
    addNewElement(content, "p", [], "Could not load landing content.");
  }
}

const navLinks = [
    { href: "#/home"    , text: "Home" },
    { href: "#/privacy" , text: "Privacy" },
    { href: "#/feedback", text: "Feedback" },
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

  /* Checks if user is logged in and renders appropriate buttons */
  const loggedIn    = localStorage.getItem("currentUser");
  if (loggedIn) {
    const logoutBtn     = createElement("a", ["btn"], "Log out");
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

function renderLandingContent(container, data) {
  container.replaceChildren();
  formatElement(container, {padding: "3vw",})

  addNewElement(container, "h1", ["centered"], data.title);

  if (data.subtitle) {
    addNewElement(container, "h3", ["centered"], data.subtitle);
  }

  data.intro?.forEach((paragraph) => {
    addNewElement(container, "p", [], paragraph);
  });

  data.sections?.forEach((section) => {
    const sectionWrap = createElement("section", ["landing-section"]);
    insertElement(container, sectionWrap);
    addNewElement(sectionWrap, "h3", [], section.heading);

    section.paragraphs?.forEach((paragraph) => {
      addNewElement(sectionWrap, "p", [], paragraph);
    });

    if (section.bullets?.length) {
      const list = createElement("ul", []);
      insertElement(sectionWrap, list);
      section.bullets.forEach((itemText) => {
        addNewElement(list, "li", [], itemText);
      });
    }
  });

  if (data.contact) {
    const contactWrap = createElement("section", ["landing-section", "landing-contact"]);
    insertElement(container, contactWrap);
    addNewElement(contactWrap, "h3", [], data.contact.heading || "Contact");

    data.contact.paragraphs?.forEach((paragraph) => {
      addNewElement(contactWrap, "p", [], paragraph);
    });

    if (data.contact.links?.length) {
      const links = createElement("div", ["landing-links"]);
      insertElement(contactWrap, links);

      data.contact.links.forEach((link) => {
        const anchor = createElement("a", [], link.label || link.href);
        formatElement(anchor, {}, [], {
          href: link.href,
          target: "_blank",
          rel: "noopener noreferrer",
        });
        insertElement(links, anchor);
      });
    }
  }
}


