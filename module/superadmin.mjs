import { createElement, createInput } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
const root = document.getElementById("root");
const required = true;

export function renderSuperadminPage() {
    root.innerHTML = "";
    renderNavBar(root);
    renderDashboard();
}

function renderDashboard() {
    const wrapper = createElement(root, "div", ["dashboard"]);

    // Header
    const header = createElement(wrapper, "div", ["dashboard-header"]);
    createElement(header, "h2", [], "Superadmin");
    const logoutBtn = createElement(header, "button", ["btn-danger"], "Log out");
    logoutBtn.addEventListener("click", () => {
        // TODO: Firebase sign out
        window.location.hash = "#/login";
    });

    // Create school section
    const createSection = createElement(wrapper, "div", ["card", "dashboard-section"]);
    createElement(createSection, "h3", [], "Create school");

    const form = createElement(createSection, "form", []);
    form.addEventListener("submit", handleCreateSchool);

    const nameGroup = createElement(form, "div", ["form-group"]);
    createElement(nameGroup, "label", [], "School name");
    createInput(nameGroup, "text", "school-name", "e.g. Harvard University", required);

    const emailGroup = createElement(form, "div", ["form-group"]);
    createElement(emailGroup, "label", [], "Admin email");
    createInput(emailGroup, "email", "school-admin-email", "admin@school.com", required);

    const errorMsg = createElement(form, "div", ["error-text"]);
    errorMsg.id = "create-school-error";

    const submitBtn = createElement(form, "button", [], "Create");
    submitBtn.type = "submit";

    // Schools list
    const listSection = createElement(wrapper, "div", ["card", "dashboard-section"]);
    createElement(listSection, "h3", [], "Schools");
    const schoolList = createElement(listSection, "div", ["item-list"]);
    schoolList.id = "school-list";

    loadSchools(schoolList);
}

function handleCreateSchool(e) {
    e.preventDefault();
    const name = document.getElementById("school-name").value;
    const email = document.getElementById("school-admin-email").value;
    const errorEl = document.getElementById("create-school-error");

    if (!name || !email) {
        errorEl.textContent = "Fill in all fields.";
        return;
    }
    errorEl.textContent = "";

    // TODO: Call Function to create school + school admin account
    console.log("Create school:", name, email);
}

function loadSchools(container) {
    // TODO: Fetch schools from Firestore
    // For now, show placeholder
    container.innerHTML = "";
    const placeholder = createElement(container, "p", ["muted"], "No schools yet.");
    placeholder.style.fontStyle = "italic";
}
