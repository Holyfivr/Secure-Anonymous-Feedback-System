import { createElement, createInput, showSpinner, hideSpinner, insertElement, addNewElement, formatElement } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
import { auth, db, fn, requireAuth, escapeHtml, collection, getDocs, sendPasswordResetEmail }
    from "./firebase-config.mjs";

const root = document.getElementById("root");
const required = true;

/* ========================================== */
/*              PAGE #/schooladmin            */
/* ========================================== */
export async function renderSchooladminPage() {
    const token             = await requireAuth("schooladmin");
    if (!token)             return;

    root.innerHTML          = "";
    renderNavBar            (root, true);
    renderDashboard         (token.claims.schoolId);
}

function renderDashboard(schoolId) {
    const wrapper           = createElement("div", ["dashboard"]);
    const header            = createElement("div", ["dashboard-header"]);
    const createSection     = createElement("div", ["card", "dashboard-section"]);
    const form              = createElement("form", []);
    const nameGroup         = createElement("div", ["form-group"]);
    const emailGroup        = createElement("div", ["form-group"]);
    const errorMsg          = createElement("div", ["error-text"]);
    const submitBtn         = createElement("button", [], "Create");
    const listSection       = createElement("div", ["card", "dashboard-section"]);
    const listHeader        = createElement("div", ["dashboard-header"]);
    const countBadge        = createElement("span", ["badge"], "…");
    const classList         = createElement("div", ["item-list"]);

    /* Main layout */
    insertElement           (root, wrapper);
    insertElement           (wrapper, header);
    addNewElement           (header, "h2", [], "School Admin");

    /* Create class section */
    insertElement           (wrapper, createSection);
    addNewElement           (createSection, "h3", [], "Create class");

    insertElement           (createSection, form);
    form.addEventListener   ("submit", (e) => handleCreateClass(e, schoolId));

    insertElement           (form, nameGroup);
    addNewElement           (nameGroup, "label", [], "Class name");
    createInput             (nameGroup, "text", "class-name", "e.g. Math 101", required);

    insertElement           (form, emailGroup);
    addNewElement           (emailGroup, "label", [], "Rep email");
    createInput             (emailGroup, "email", "class-admin-email", "rep@school.com", required);

    formatElement           (errorMsg, {}, [], { id: "create-class-error" });
    insertElement           (form, errorMsg);

    formatElement           (submitBtn, {}, [], { type: "submit" });
    insertElement           (form, submitBtn);

    /* Classes list */
    insertElement           (wrapper, listSection);
    insertElement           (listSection, listHeader);
    addNewElement           (listHeader, "h3", [], "Classes");
    formatElement           (countBadge, {}, [], { id: "class-count" });
    insertElement           (listHeader, countBadge);
    formatElement           (classList, {}, [], { id: "class-list" });
    insertElement           (listSection, classList);

    loadClasses             (classList, schoolId);
}

/* ========================================== */
/*               FORM ACTIONS                 */
/* ========================================== */
async function handleCreateClass(e, schoolId) {
    e.preventDefault();
    const name              = document.getElementById("class-name").value;
    const email             = document.getElementById("class-admin-email").value;
    const errorEl           = document.getElementById("create-class-error");

    if (!name || !email) {
        errorEl.textContent = "Fill in all fields.";
        return;
    }

    errorEl.textContent = "";

    try {
        const tempFeedbackPassword  = crypto.randomUUID().slice(0, 12);
        const tempPassword          = crypto.randomUUID().slice(0, 12);

        await fn.createClass        ({
            className: name,
            adminEmail: email,
            adminPassword: tempPassword,
            feedbackPassword: tempFeedbackPassword,
        });

        await sendPasswordResetEmail(auth, email);

        const success = document.getElementById("create-class-error");
        success.classList.remove("error-text");
        success.classList.add("success-text");
        success.innerHTML =
            `<strong>Class created!</strong><br>` +
            `Student email: <code>${escapeHtml(email)}</code><br>` +
            `<em>A password setup email has been sent to the student representative.</em>`;

        const classList = document.getElementById("class-list");
        loadClasses(classList, schoolId);
        e.target.reset();
    } catch (err) {
        const error2 = document.getElementById("create-class-error");
        error2.classList.remove("success-text");
        error2.classList.add("error-text");

        const code      = err.code?.replace("functions/", "");
        const messages  = {
            "already-exists": "That email is already in use.",
            "permission-denied": "You don't have permission to do this.",
            "unauthenticated": "You must be logged in.",
            "invalid-argument": err.message,
        };

        error2.textContent = messages[code] || err.message || "Something went wrong. Try again.";
    }
}

/* ========================================== */
/*                  CLASS LIST                */
/* ========================================== */
async function loadClasses(container, schoolId) {
    container.innerHTML      = "";
    showSpinner              (container);

    try {
        const snapshot        = await getDocs(collection(db, "schools", schoolId, "classes"));
        hideSpinner           (container);

        const classes         = snapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name,
            active: doc.data().active,
        }));

        const counter = document.getElementById("class-count");
        counter.textContent = classes.length;

        if (classes.length === 0) {
            const placeholder = addNewElement(container, "p", [], "No classes yet.");
            formatElement(placeholder, { fontStyle: "italic" });
            return;
        }

        classes.forEach((classroom) => {
            const row           = createElement("div", ["item-row"]);
            const actions       = createElement("div", ["item-actions"]);
            const toggleBtn     = createElement(
                "button",
                ["btn-small", classroom.active ? "btn-active" : "btn-inactive"],
                classroom.active ? "Active" : "Inactive"
            );

            insertElement       (container, row);
            addNewElement       (row, "span", [], classroom.name);
            insertElement       (row, actions);
            formatElement       (toggleBtn, {}, [], { type: "button" });
            insertElement       (actions, toggleBtn);
            toggleBtn.addEventListener("click", () => handleToggleClass(classroom.id, schoolId, toggleBtn, row));

            if (!classroom.active) {
                const deleteBtn = createElement("button", ["btn-danger", "btn-small"], "Delete");
                formatElement   (deleteBtn, {}, [], { type: "button" });
                insertElement   (actions, deleteBtn);
                deleteBtn.addEventListener("click", () => handleDeleteClass(classroom.id, classroom.name, schoolId));
            }
        });
    } catch (err) {
        hideSpinner             (container);
        addNewElement           (container, "p", ["error-text"], "Failed to load classes.");
    }
}

/* ========================================== */
/*                  ITEM ACTIONS              */
/* ========================================== */
async function handleToggleClass(classId, schoolId, toggleBtn, row) {
    const wasActive         = toggleBtn.textContent === "Active";
    toggleBtn.textContent   = wasActive ? "Inactive" : "Active";
    toggleBtn.classList.toggle("btn-active", !wasActive);
    toggleBtn.classList.toggle("btn-inactive", wasActive);
    formatElement           (toggleBtn, {}, [], { disabled: true });

    try {
        await fn.toggleActive({ schoolId, classId });
        formatElement       (toggleBtn, {}, [], { disabled: false });

        if (wasActive) {
            const actions   = row.querySelector(".item-actions");
            const deleteBtn = createElement("button", ["btn-danger", "btn-small"], "Delete");
            formatElement   (deleteBtn, {}, [], { type: "button" });
            insertElement   (actions, deleteBtn);
            deleteBtn.addEventListener("click", () => {
                const name = row.querySelector("span").textContent;
                handleDeleteClass(classId, name, schoolId);
            });
        } else {
            const deleteBtn = row.querySelector(".btn-danger");
            if (deleteBtn) deleteBtn.remove();
        }
    } catch (err) {
        toggleBtn.textContent   = wasActive ? "Active" : "Inactive";
        toggleBtn.classList.toggle("btn-active", wasActive);
        toggleBtn.classList.toggle("btn-inactive", !wasActive);
        formatElement           (toggleBtn, {}, [], { disabled: false });
        alert(err.message || "Failed to toggle class.");
    }
}

async function handleDeleteClass(classId, className, schoolId) {
    if (!confirm(`Delete "${className}" and all its messages? This cannot be undone.`)) return;

    try {
        await fn.deleteClass({ classId });

        const classList = document.getElementById("class-list");
        loadClasses      (classList, schoolId);
    } catch (err) {
        alert(err.message || "Failed to delete class.");
    }
}
