import { createElement, createInput, showSpinner, hideSpinner, insertElement, addNewElement, formatElement } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
import { auth, db, signOut, fn, collection, getDocs, requireAuth, escapeHtml, sendPasswordResetEmail }
    from "./firebase-config.mjs";

const root = document.getElementById("root");
const required = true;

/* ========================================== */
// PAGE #/superadmin
/* ========================================== */
export async function renderSuperadminPage() {
    const token             = await requireAuth("superadmin");
    if (!token)             return;

    root.innerHTML          = "";
    renderNavBar            (root, true);
    renderDashboard         ();
}

function renderDashboard() {
    const wrapper           = createElement("div", ["dashboard"]);
    const header            = createElement("div", ["dashboard-header"]);
    const createSection     = createElement("div", ["card", "dashboard-section"]);
    const form              = createElement("form", []);
    const nameGroup         = createElement("div", ["form-group"]);
    const emailGroup        = createElement("div", ["form-group"]);
    const errorMsg          = createElement("div", ["error-text"]);
    const submitBtn         = createElement("button", [], "Create");
    const listSection       = createElement("div", ["card", "dashboard-section"]);
    const schoolList        = createElement("div", ["item-list"]);

    // Main layout
    insertElement           (root, wrapper);
    insertElement           (wrapper, header);
    addNewElement           (header, "h2", [], "Superadmin");

    // Create school section
    insertElement           (wrapper, createSection);
    addNewElement           (createSection, "h3", [], "Create school");

    insertElement           (createSection, form);
    form.addEventListener   ("submit", handleCreateSchool);

    insertElement           (form, nameGroup);
    addNewElement           (nameGroup, "label", [], "School name");
    createInput             (nameGroup, "text", "school-name", "e.g. Harvard University", required);

    insertElement           (form, emailGroup);
    addNewElement           (emailGroup, "label", [], "Admin email");
    createInput             (emailGroup, "email", "school-admin-email", "admin@school.com", required);

    formatElement           (errorMsg, {}, [], { id: "create-school-error" });
    insertElement           (form, errorMsg);

    formatElement           (submitBtn, {}, [], { type: "submit" });
    insertElement           (form, submitBtn);

    // Schools list
    insertElement           (wrapper, listSection);
    addNewElement           (listSection, "h3", [], "Schools");
    formatElement           (schoolList, {}, [], { id: "school-list" });
    insertElement           (listSection, schoolList);

    loadSchools             (schoolList);
}

/* ========================================== */
// FORM ACTIONS
/* ========================================== */
async function handleCreateSchool(e) {
    e.preventDefault();
    const name              = document.getElementById("school-name").value;
    const email             = document.getElementById("school-admin-email").value;
    const errorEl           = document.getElementById("create-school-error");

    if (!name || !email) {
        errorEl.textContent = "Fill in all fields.";
        return;
    }

    errorEl.textContent = "";

    try {
        const tempPassword  = crypto.randomUUID().slice(0, 12);

        await fn.createSchool({
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

        const code      = err.code?.replace("functions/", "");
        const messages  = {
            "already-exists": "That email is already in use.",
            "permission-denied": "You don't have permission to do this.",
            "unauthenticated": "You must be logged in.",
            "invalid-argument": err.message,
        };
        errorEl2.textContent = messages[code] || err.message || "Something went wrong. Try again.";
    }
}

/* ========================================== */
// SCHOOL LIST
/* ========================================== */
async function loadSchools(container) {
    container.innerHTML      = "";
    showSpinner              (container);

    try {
        const snapshot        = await getDocs(collection(db, "schools"));
        hideSpinner           (container);

        if (snapshot.empty) {
            const placeholder = addNewElement(container, "p", ["muted"], "No schools yet.");
            formatElement     (placeholder, { fontStyle: "italic" });
            return;
        }

        snapshot.forEach((doc) => {
            const data          = doc.data();
            const item          = createElement("div", ["school-item"]);
            const row           = createElement("div", ["item-row"]);
            const actions       = createElement("div", ["item-actions"]);
            const toggleBtn     = createElement(
                "button",
                ["btn-small", data.active ? "btn-active" : "btn-inactive"],
                data.active ? "Active" : "Inactive"
            );
            const viewBtn       = createElement("button", ["btn-small"], "View classes");

            insertElement       (container, item);
            insertElement       (item, row);
            addNewElement       (row, "span", [], data.name);
            insertElement       (row, actions);
            formatElement       (toggleBtn, {}, [], { type: "button" });
            insertElement       (actions, toggleBtn);
            toggleBtn.addEventListener("click", () => handleToggleSchool(doc.id, container));
            formatElement       (viewBtn, {}, [], { type: "button" });
            insertElement       (actions, viewBtn);
            viewBtn.addEventListener("click", () => handleViewClasses(doc.id, item, viewBtn));

            if (!data.active) {
                const deleteBtn = createElement("button", ["btn-danger", "btn-small"], "Delete");
                formatElement   (deleteBtn, {}, [], { type: "button" });
                insertElement   (actions, deleteBtn);
                deleteBtn.addEventListener("click", () => handleDeleteSchool(doc.id, data.name, container));
            }
        });
    } catch (err) {
        hideSpinner             (container);
        addNewElement           (container, "p", ["error-text"], "Failed to load schools.");
    }
}

/* ========================================== */
// ITEM ACTIONS
/* ========================================== */
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
    const existing = schoolItem.querySelector(".sub-list");
    if (existing) {
        existing.remove();
        viewBtn.textContent = "View classes";
        return;
    }

    viewBtn.textContent = "Hide classes";
    const subList = createElement("div", ["sub-list"]);
    insertElement (schoolItem, subList);
    showSpinner   (subList);

    try {
        const snapshot    = await getDocs(collection(db, "schools", schoolId, "classes"));
        hideSpinner       (subList);

        const classes     = snapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name,
            active: doc.data().active,
        }));

        if (classes.length === 0) {
            const p = addNewElement(subList, "p", ["muted"], "No classes.");
            formatElement(p, { fontStyle: "italic" });
            return;
        }

        classes.forEach((cls) => {
            const row           = createElement("div", ["sub-item"]);
            const badgeClasses  = ["badge"];

            insertElement       (subList, row);
            addNewElement       (row, "span", [], cls.name);

            if (!cls.active) badgeClasses.push("badge-inactive");
            addNewElement(row, "span", badgeClasses, cls.active ? "Active" : "Inactive");
        });
    } catch (err) {
        hideSpinner             (subList);
        addNewElement           (subList, "p", ["error-text"], "Failed to load classes.");
    }
}
