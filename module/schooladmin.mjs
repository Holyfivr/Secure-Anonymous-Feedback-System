import { createElement, createInput } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
import { auth, db, signOut, fn, requireAuth, escapeHtml, collection, getDocs }
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
    const wrapper = createElement(root, "div", ["dashboard"]);

    // Header
    const header = createElement(wrapper, "div", ["dashboard-header"]);
    createElement(header, "h2", [], "School Admin");

    // Create class section
    const createSection = createElement(wrapper, "div", ["card", "dashboard-section"]);
    createElement(createSection, "h3", [], "Create class");

    const form = createElement(createSection, "form", []);
    form.addEventListener("submit", (e) => handleCreateClass(e, schoolId));

    const nameGroup = createElement(form, "div", ["form-group"]);
    createElement(nameGroup, "label", [], "Class name");
    createInput(nameGroup, "text", "class-name", "e.g. Math 101", required);

    const emailGroup = createElement(form, "div", ["form-group"]);
    createElement(emailGroup, "label", [], "Rep email");
    createInput(emailGroup, "email", "class-admin-email", "rep@school.com", required);

    const postPassGroup = createElement(form, "div", ["form-group"]);
    createElement(postPassGroup, "label", [], "Post password");
    createInput(postPassGroup, "text", "class-post-password", "Password students use to post", required);

    const errorMsg = createElement(form, "div", ["error-text"]);
    errorMsg.id = "create-class-error";

    const submitBtn = createElement(form, "button", [], "Create");
    submitBtn.type = "submit";

    // Classes list
    const listSection = createElement(wrapper, "div", ["card", "dashboard-section"]);
    const listHeader = createElement(listSection, "div", ["dashboard-header"]);
    createElement(listHeader, "h3", [], "Classes");
    const countBadge = createElement(listHeader, "span", ["badge"], "…");
    countBadge.id = "class-count";

    const classList = createElement(listSection, "div", ["item-list"]);
    classList.id = "class-list";

    loadClasses(classList, schoolId);
}

async function handleCreateClass(e, schoolId) {
    e.preventDefault();
    const name = document.getElementById("class-name").value;
    const email = document.getElementById("class-admin-email").value;
    const postPassword = document.getElementById("class-post-password").value;
    const errorEl = document.getElementById("create-class-error");

    if (!name || !email || !postPassword) {
        errorEl.textContent = "Fill in all fields.";
        return;
    }
    errorEl.textContent = "";

    try {
        const tempPassword = crypto.randomUUID().slice(0, 12);
        await fn.createClass({
            className: name,
            adminEmail: email,
            adminPassword: tempPassword,
            postPassword: postPassword,
        });

        const successEl = document.getElementById("create-class-error");
        successEl.classList.remove("error-text");
        successEl.classList.add("success-text");
        successEl.innerHTML =
            `<strong>Class created!</strong><br>` +
            `Student email: <code>${escapeHtml(email)}</code><br>` +
            `Student password: <code>${escapeHtml(tempPassword)}</code><br>` +
            `Feedback password: <code>${escapeHtml(postPassword)}</code><br>` +
            `<em>Save these. They won't be shown again.</em>`;

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
    const spinner = createElement(container, "div", ["loading-spinner"]);

    try {
        // Direct Firestore read — authorized by security rules for schooladmin
        const snapshot = await getDocs(collection(db, "schools", schoolId, "classes"));
        spinner.remove();

        const classes = snapshot.docs.map(d => ({ id: d.id, name: d.data().name, active: d.data().active }));

        const countEl = document.getElementById("class-count");
        countEl.textContent = classes.length;

        if (classes.length === 0) {
            const placeholder = createElement(container, "p", ["muted"], "No classes yet.");
            placeholder.style.fontStyle = "italic";
            return;
        }

        classes.forEach((cls) => {
            const row = createElement(container, "div", ["item-row"]);
            createElement(row, "span", [], cls.name);

            const actions = createElement(row, "div", ["item-actions"]);

            // Toggle active/inactive button
            const toggleBtn = createElement(actions, "button", ["btn-small", cls.active ? "btn-active" : "btn-inactive"], cls.active ? "Active" : "Inactive");
            toggleBtn.addEventListener("click", () => handleToggleClass(cls.id, schoolId, toggleBtn, row));

            // Send new credentials
            const sendBtn = createElement(actions, "button", ["btn-small"], "Send New Credentials");
            sendBtn.addEventListener("click", async () => {
                if (!confirm(`Send new credentials email to the class admin of "${cls.name}"?`)) return;
                try {
                    await fn.resetClassCredentials({ classId: cls.id });
                    alert("Email sent successfully.");
                } catch (err) {
                    alert(err.message || "Failed to send email.");
                }
            });

            // Delete button — only for inactive classes
            if (!cls.active) {
                const deleteBtn = createElement(actions, "button", ["btn-danger", "btn-small"], "Delete");
                deleteBtn.addEventListener("click", () => handleDeleteClass(cls.id, cls.name, schoolId));
            }
        });
    } catch (err) {
        spinner.remove();
        createElement(container, "p", ["error-text"], "Failed to load classes.");
    }
}

async function handleToggleClass(classId, schoolId, toggleBtn, row) {
    // Optimistic UI: immediately toggle the button appearance
    const wasActive = toggleBtn.textContent === "Active";
    toggleBtn.textContent = wasActive ? "Inactive" : "Active";
    toggleBtn.classList.toggle("btn-active", !wasActive);
    toggleBtn.classList.toggle("btn-inactive", wasActive);
    toggleBtn.disabled = true;

    try {
        await fn.toggleActive({ schoolId, classId });
        toggleBtn.disabled = false;

        // If we just deactivated, add a delete button; if activated, remove it
        if (wasActive) {
            const actions = row.querySelector(".item-actions");
            const deleteBtn = createElement(actions, "button", ["btn-danger", "btn-small"], "Delete");
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
        toggleBtn.disabled = false;
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
