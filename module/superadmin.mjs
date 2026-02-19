import { createElement, createInput } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
import { auth, functions, db, signOut, httpsCallable, collection, getDocs }
    from "./firebase-config.mjs";
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
    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
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

async function handleCreateSchool(e) {
    e.preventDefault();
    const name = document.getElementById("school-name").value;
    const email = document.getElementById("school-admin-email").value;
    const errorEl = document.getElementById("create-school-error");

    if (!name || !email) {
        errorEl.textContent = "Fill in all fields.";
        return;
    }
    errorEl.textContent = "";

    try {
        const tempPassword = crypto.randomUUID().slice(0, 12);
        const createSchool = httpsCallable(functions, "createSchool");
        const result = await createSchool({
            schoolName: name,
            adminEmail: email,
            adminPassword: tempPassword,
        });

        // Show credentials to superadmin
        const successEl = document.getElementById("create-school-error");
        successEl.classList.remove("error-text");
        successEl.classList.add("success-text");
        successEl.innerHTML =
            `<strong>School created!</strong><br>` +
            `Email: <code>${email}</code><br>` +
            `Temporary password: <code>${tempPassword}</code><br>` +
            `<em>Save this — it won't be shown again.</em>`;

        // Refresh list
        const schoolList = document.getElementById("school-list");
        loadSchools(schoolList);
        e.target.reset();
    } catch (err) {
        const errorEl2 = document.getElementById("create-school-error");
        errorEl2.classList.remove("success-text");
        errorEl2.classList.add("error-text");
        errorEl2.textContent = err.message || "Failed to create school.";
    }
}

async function loadSchools(container) {
    container.innerHTML = "";
    try {
        const snapshot = await getDocs(collection(db, "schools"));
        if (snapshot.empty) {
            const placeholder = createElement(container, "p", ["muted"], "No schools yet.");
            placeholder.style.fontStyle = "italic";
            return;
        }
        snapshot.forEach((doc) => {
            const data = doc.data();
            const row = createElement(container, "div", ["item-row"]);
            createElement(row, "span", [], data.name);
            const badge = createElement(row, "span", ["badge"], data.active ? "Active" : "Inactive");
            if (!data.active) badge.classList.add("badge-inactive");
        });
    } catch (err) {
        createElement(container, "p", ["error-text"], "Failed to load schools.");
    }
}
