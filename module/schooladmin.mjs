import { createElement, createInput } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
import { auth, functions, db, signOut, httpsCallable, collection, getDocs, requireAuth }
    from "./firebase-config.mjs";

const root = document.getElementById("root");
const required = true;

export async function renderSchooladminPage() {
    const token = await requireAuth("schooladmin");
    if (!token) return;

    root.innerHTML = "";
    renderNavBar(root);
    renderDashboard(token.claims.schoolId);
}

function renderDashboard(schoolId) {
    const wrapper = createElement(root, "div", ["dashboard"]);

    // Header
    const header = createElement(wrapper, "div", ["dashboard-header"]);
    createElement(header, "h2", [], "School Admin");
    const logoutBtn = createElement(header, "button", ["btn-danger"], "Log out");
    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
        window.location.hash = "#/login";
    });

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
    const countBadge = createElement(listHeader, "span", ["badge"], "0");
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
        const createClass = httpsCallable(functions, "createClass");
        await createClass({
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
            `Student email: <code>${email}</code><br>` +
            `Student password: <code>${tempPassword}</code><br>` +
            `Feedback password: <code>${postPassword}</code><br>` +
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
    try {
        const snapshot = await getDocs(collection(db, "schools", schoolId, "classes"));
        const countEl = document.getElementById("class-count");
        countEl.textContent = snapshot.size;

        if (snapshot.empty) {
            const placeholder = createElement(container, "p", ["muted"], "No classes yet.");
            placeholder.style.fontStyle = "italic";
            return;
        }
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const row = createElement(container, "div", ["item-row"]);
            createElement(row, "span", [], data.name);

            const actions = createElement(row, "div", ["item-actions"]);

            // Toggle active/inactive button
            const toggleBtn = createElement(actions, "button", ["btn-small", data.active ? "btn-active" : "btn-inactive"], data.active ? "Active" : "Inactive");
            toggleBtn.addEventListener("click", () => handleToggleClass(docSnap.id, schoolId));

            // Delete button — only for inactive classes
            if (!data.active) {
                const deleteBtn = createElement(actions, "button", ["btn-danger", "btn-small"], "Delete");
                deleteBtn.addEventListener("click", () => handleDeleteClass(docSnap.id, data.name, schoolId));
            }
        });
    } catch (err) {
        createElement(container, "p", ["error-text"], "Failed to load classes.");
    }
}

async function handleToggleClass(classId, schoolId) {
    try {
        const toggleActive = httpsCallable(functions, "toggleActive");
        await toggleActive({ schoolId, classId });

        const classList = document.getElementById("class-list");
        loadClasses(classList, schoolId);
    } catch (err) {
        alert(err.message || "Failed to toggle class.");
    }
}

async function handleDeleteClass(classId, className, schoolId) {
    if (!confirm(`Delete "${className}" and all its messages? This cannot be undone.`)) return;

    try {
        const deleteClass = httpsCallable(functions, "deleteClass");
        await deleteClass({ classId });

        const classList = document.getElementById("class-list");
        loadClasses(classList, schoolId);
    } catch (err) {
        alert(err.message || "Failed to delete class.");
    }
}
