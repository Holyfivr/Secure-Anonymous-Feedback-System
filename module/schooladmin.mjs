import { createElement, createInput, showSpinner, hideSpinner, insertElement, addNewElement, formatElement } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
import { auth, db, signOut, fn, requireAuth, escapeHtml, collection, getDocs, sendPasswordResetEmail }
    from "./firebase-config.mjs";

const root = document.getElementById("root");
const required = true;

export async function renderSchooladminPage() {
    const token = await requireAuth("schooladmin");
    if (!token) return;

    root.innerHTML = "";
    renderNavBar(root, true);
    renderDashboard(token.claims.schoolId);
}

function renderDashboard(schoolId) {
    const wrapper = createElement("div", ["dashboard"]);
    insertElement(root, wrapper);

    // Header
    const header = createElement("div", ["dashboard-header"]);
    insertElement(wrapper, header);
    addNewElement(header, "h2", [], "School Admin");

    // Create class section
    const createSection = createElement("div", ["card", "dashboard-section"]);
    insertElement(wrapper, createSection);
    addNewElement(createSection, "h3", [], "Create class");

    const form = createElement("form", []);
    insertElement(createSection, form);
    form.addEventListener("submit", (e) => handleCreateClass(e, schoolId));

    const nameGroup = createElement("div", ["form-group"]);
    insertElement(form, nameGroup);
    addNewElement(nameGroup, "label", [], "Class name");
    createInput(nameGroup, "text", "class-name", "e.g. Math 101", required);

    const emailGroup = createElement("div", ["form-group"]);
    insertElement(form, emailGroup);
    addNewElement(emailGroup, "label", [], "Rep email");
    createInput(emailGroup, "email", "class-admin-email", "rep@school.com", required);

    const errorMsg = createElement("div", ["error-text"]);
    formatElement(errorMsg, {}, [], { id: "create-class-error" });
    insertElement(form, errorMsg);

    const submitBtn = createElement("button", [], "Create");
    formatElement(submitBtn, {}, [], { type: "submit" });
    insertElement(form, submitBtn);

    // Classes list
    const listSection = createElement("div", ["card", "dashboard-section"]);
    insertElement(wrapper, listSection);

    const listHeader = createElement("div", ["dashboard-header"]);
    insertElement(listSection, listHeader);
    addNewElement(listHeader, "h3", [], "Classes");

    const countBadge = createElement("span", ["badge"], "…");
    formatElement(countBadge, {}, [], { id: "class-count" });
    insertElement(listHeader, countBadge);

    const classList = createElement("div", ["item-list"]);
    formatElement(classList, {}, [], { id: "class-list" });
    insertElement(listSection, classList);

    loadClasses(classList, schoolId);
}

async function handleCreateClass(e, schoolId) {
    e.preventDefault();
    const name = document.getElementById("class-name").value;
    const email = document.getElementById("class-admin-email").value;
    const errorEl = document.getElementById("create-class-error");

    if (!name || !email) {
        errorEl.textContent = "Fill in all fields.";
        return;
    }
    errorEl.textContent = "";

    try {
        const tempFeedbackPassword = crypto.randomUUID().slice(0, 12);
        const tempPassword = crypto.randomUUID().slice(0, 12);
        await fn.createClass({
            className: name,
            adminEmail: email,
            adminPassword: tempPassword,
            feedbackPassword: tempFeedbackPassword,
        });

        await sendPasswordResetEmail(auth, email);

        const successEl = document.getElementById("create-class-error");
        successEl.classList.remove("error-text");
        successEl.classList.add("success-text");
        successEl.innerHTML =
            `<strong>Class created!</strong><br>` +
            `Student email: <code>${escapeHtml(email)}</code><br>` +
            `Feedback password: <code>${escapeHtml(tempFeedbackPassword)}</code><br>` +
            `<em>A password setup email has been sent to the student representative.</em>`;

        const classList = document.getElementById("class-list");
        loadClasses(classList, schoolId);
        e.target.reset();
    } catch (err) {
        const errorEl2 = document.getElementById("create-class-error");
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

async function loadClasses(container, schoolId) {
    container.innerHTML = "";
    showSpinner(container);

    try {
        // Direct Firestore read — authorized by security rules for schooladmin
        const snapshot = await getDocs(collection(db, "schools", schoolId, "classes"));
        hideSpinner(container);

        const classes = snapshot.docs.map(d => ({ id: d.id, name: d.data().name, active: d.data().active }));

        const countEl = document.getElementById("class-count");
        countEl.textContent = classes.length;

        if (classes.length === 0) {
            const placeholder = addNewElement(container, "p", ["muted"], "No classes yet.");
            formatElement(placeholder, { fontStyle: "italic" });
            return;
        }

        classes.forEach((cls) => {
            const row = createElement("div", ["item-row"]);
            insertElement(container, row);
            addNewElement(row, "span", [], cls.name);

            const actions = createElement("div", ["item-actions"]);
            insertElement(row, actions);

            // Toggle active/inactive button
            const toggleBtn = createElement("button", ["btn-small", cls.active ? "btn-active" : "btn-inactive"], cls.active ? "Active" : "Inactive");
            formatElement(toggleBtn, {}, [], { type: "button" });
            insertElement(actions, toggleBtn);
            toggleBtn.addEventListener("click", () => handleToggleClass(cls.id, schoolId, toggleBtn, row));

            // Delete button — only for inactive classes
            if (!cls.active) {
                const deleteBtn = createElement("button", ["btn-danger", "btn-small"], "Delete");
                formatElement(deleteBtn, {}, [], { type: "button" });
                insertElement(actions, deleteBtn);
                deleteBtn.addEventListener("click", () => handleDeleteClass(cls.id, cls.name, schoolId));
            }
        });
    } catch (err) {
        hideSpinner(container);
        addNewElement(container, "p", ["error-text"], "Failed to load classes.");
    }
}

async function handleToggleClass(classId, schoolId, toggleBtn, row) {
    // Optimistic UI: immediately toggle the button appearance
    const wasActive = toggleBtn.textContent === "Active";
    toggleBtn.textContent = wasActive ? "Inactive" : "Active";
    toggleBtn.classList.toggle("btn-active", !wasActive);
    toggleBtn.classList.toggle("btn-inactive", wasActive);
    formatElement(toggleBtn, {}, [], { disabled: true });

    try {
        await fn.toggleActive({ schoolId, classId });
        formatElement(toggleBtn, {}, [], { disabled: false });

        // If we just deactivated, add a delete button; if activated, remove it
        if (wasActive) {
            const actions = row.querySelector(".item-actions");
            const deleteBtn = createElement("button", ["btn-danger", "btn-small"], "Delete");
            formatElement(deleteBtn, {}, [], { type: "button" });
            insertElement(actions, deleteBtn);
            deleteBtn.addEventListener("click", () => {
                const name = row.querySelector("span").textContent;
                handleDeleteClass(classId, name, schoolId);
            });
        } else {
            const deleteBtn = row.querySelector(".btn-danger");
            if (deleteBtn) deleteBtn.remove();
        }
    } catch (err) {
        // Revert on failure
        toggleBtn.textContent = wasActive ? "Active" : "Inactive";
        toggleBtn.classList.toggle("btn-active", wasActive);
        toggleBtn.classList.toggle("btn-inactive", !wasActive);
        formatElement(toggleBtn, {}, [], { disabled: false });
        alert(err.message || "Failed to toggle class.");
    }
}

async function handleDeleteClass(classId, className, schoolId) {
    if (!confirm(`Delete "${className}" and all its messages? This cannot be undone.`)) return;

    try {
        await fn.deleteClass({ classId });

        const classList = document.getElementById("class-list");
        loadClasses(classList, schoolId);
    } catch (err) {
        alert(err.message || "Failed to delete class.");
    }
}
