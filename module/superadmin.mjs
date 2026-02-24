import { createElement, createInput, showSpinner, hideSpinner } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
import { auth, db, signOut, fn, collection, getDocs, requireAuth, escapeHtml, sendPasswordResetEmail }
    from "./firebase-config.mjs";
const root = document.getElementById("root");
const required = true;

export async function renderSuperadminPage() {
    const token = await requireAuth("superadmin");
    if (!token) return;

    root.innerHTML = "";
    renderNavBar(root, true);
    renderDashboard();
}

function renderDashboard() {
    const wrapper = createElement(root, "div", ["dashboard"]);

    // Header
    const header = createElement(wrapper, "div", ["dashboard-header"]);
    createElement(header, "h2", [], "Superadmin");

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
        const result = await fn.createSchool({
            schoolName: name,
            adminEmail: email,
            adminPassword: tempPassword,
        });

        await sendPasswordResetEmail(auth, email);

        // Show creation info to superadmin (escaped to prevent XSS)
        const successEl = document.getElementById("create-school-error");
        successEl.classList.remove("error-text");
        successEl.classList.add("success-text");
        successEl.innerHTML =
            `<strong>School created!</strong><br>` +
            `Email: <code>${escapeHtml(email)}</code><br>` +
            `<em>A password setup email has been sent to the school admin.</em>`;

        // Refresh list
        const schoolList = document.getElementById("school-list");
        loadSchools(schoolList);
        e.target.reset();
    } catch (err) {
        const errorEl2 = document.getElementById("create-school-error");
        errorEl2.classList.remove("success-text");
        errorEl2.classList.add("error-text");

        const code = err.code?.replace("functions/", "");
        const messages = {
            "already-exists": "That email is already in use.",
            "permission-denied": "You don't have permission to do this.",
            "unauthenticated": "You must be logged in.",
            "invalid-argument": err.message,
        };
        errorEl2.textContent = messages[code] || err.message || "Something went wrong. Try again.";
    }
}

async function loadSchools(container) {
    container.innerHTML = "";
    showSpinner(container);

    try {
        const snapshot = await getDocs(collection(db, "schools"));
        hideSpinner(container);

        if (snapshot.empty) {
            const placeholder = createElement(container, "p", ["muted"], "No schools yet.");
            placeholder.style.fontStyle = "italic";
            return;
        }
        snapshot.forEach((doc) => {
            const data = doc.data();
            const item = createElement(container, "div", ["school-item"]);

            const row = createElement(item, "div", ["item-row"]);
            createElement(row, "span", [], data.name);

            const actions = createElement(row, "div", ["item-actions"]);

            // Toggle active/inactive
            const toggleBtn = createElement(actions, "button", ["btn-small", data.active ? "btn-active" : "btn-inactive"], data.active ? "Active" : "Inactive");
            toggleBtn.addEventListener("click", () => handleToggleSchool(doc.id, container));

            // View classes
            const viewBtn = createElement(actions, "button", ["btn-small"], "View classes");
            viewBtn.addEventListener("click", () => handleViewClasses(doc.id, item, viewBtn));

            // Delete (only inactive)
            if (!data.active) {
                const deleteBtn = createElement(actions, "button", ["btn-danger", "btn-small"], "Delete");
                deleteBtn.addEventListener("click", () => handleDeleteSchool(doc.id, data.name, container));
            }
        });
    } catch (err) {
        hideSpinner(container);
        createElement(container, "p", ["error-text"], "Failed to load schools.");
    }
}

async function handleToggleSchool(schoolId, container) {
    try {
        await fn.toggleActive({ schoolId });
        loadSchools(container);
    } catch (err) {
        alert(err.message || "Failed to toggle school.");
    }
}

async function handleDeleteSchool(schoolId, schoolName, container) {
    if (!confirm(`Delete "${schoolName}" and ALL its classes and messages? This cannot be undone.`)) return;

    try {
        await fn.deleteSchool({ schoolId });
        loadSchools(container);
    } catch (err) {
        alert(err.message || "Failed to delete school.");
    }
}

async function handleViewClasses(schoolId, schoolItem, viewBtn) {
    // Toggle: if already showing, remove
    const existing = schoolItem.querySelector(".sub-list");
    if (existing) {
        existing.remove();
        viewBtn.textContent = "View classes";
        return;
    }

    viewBtn.textContent = "Hide classes";
    const subList = createElement(schoolItem, "div", ["sub-list"]);
    showSpinner(subList);

    try {
        // Direct Firestore read — authorized by security rules for superadmin
        const snapshot = await getDocs(collection(db, "schools", schoolId, "classes"));
        hideSpinner(subList);

        const classes = snapshot.docs.map(d => ({ id: d.id, name: d.data().name, active: d.data().active }));

        if (classes.length === 0) {
            const p = createElement(subList, "p", ["muted"], "No classes.");
            p.style.fontStyle = "italic";
            return;
        }

        classes.forEach((cls) => {
            const row = createElement(subList, "div", ["sub-item"]);
            createElement(row, "span", [], cls.name);

            const badgeClasses = ["badge"];
            if (!cls.active) badgeClasses.push("badge-inactive");
            createElement(row, "span", badgeClasses, cls.active ? "Active" : "Inactive");
        });
    } catch (err) {
        hideSpinner(subList);
        createElement(subList, "p", ["error-text"], "Failed to load classes.");
    }
}
