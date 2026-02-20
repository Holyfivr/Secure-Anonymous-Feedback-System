import { createElement, createInput } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
import { functions, httpsCallable }
    from "./firebase-config.mjs";

const root = document.getElementById("root");
const required = true;

// ==========================================
// PICKER PAGE #/feedback
// ==========================================
export async function renderFeedbackPage() {
    root.innerHTML = "";
    renderNavBar(root);

    const wrapper = createElement(root, "div", ["page-wrapper"]);
    const card = createElement(wrapper, "div", ["card", "feedback-card"]);
    createElement(card, "h2", [], "Send feedback");
    createElement(card, "p", ["muted"], "Find your class to send anonymous feedback.");

    const form = createElement(card, "form", ["feedback-picker"]);

    // School select
    const schoolGroup = createElement(form, "div", ["form-group"]);
    createElement(schoolGroup, "label", [], "School");
    const schoolSelect = createElement(schoolGroup, "select", []);
    schoolSelect.id = "pick-school";
    schoolSelect.innerHTML = `<option value="">Loading schools...</option>`;

    // Class select (disabled until school is picked)
    const classGroup = createElement(form, "div", ["form-group"]);
    createElement(classGroup, "label", [], "Class");
    const classSelect = createElement(classGroup, "select", []);
    classSelect.id = "pick-class";
    classSelect.disabled = true;
    classSelect.innerHTML = `<option value="">Pick a school first</option>`;

    const errorEl = createElement(form, "div", ["error-text"]);
    errorEl.id = "picker-error";

    const btn = createElement(form, "button", [], "Go to feedback form");
    btn.type = "submit";

    // Load schools
    try {
        const listSchools = httpsCallable(functions, "listSchools");
        const result = await listSchools();
        schoolSelect.innerHTML = `<option value="">Select school...</option>`;
        result.data.forEach((school) => {
            const option = document.createElement("option");
            option.value = school.id;
            option.textContent = school.name;
            schoolSelect.appendChild(option);
        });
    } catch (err) {
        schoolSelect.innerHTML = `<option value="">Could not load schools</option>`;
    }

    // When school is selected, load classes
    schoolSelect.addEventListener("change", async () => {
        const schoolId = schoolSelect.value;
        classSelect.innerHTML = `<option value="">Loading classes...</option>`;
        classSelect.disabled = true;

        if (!schoolId) {
            classSelect.innerHTML = `<option value="">Pick a school first</option>`;
            return;
        }

        try {
            const listClasses = httpsCallable(functions, "listClasses");
            const result = await listClasses({ schoolId });
            classSelect.innerHTML = `<option value="">Select class...</option>`;
            result.data.forEach((cls) => {
                const option = document.createElement("option");
                option.value = cls.id;
                option.textContent = cls.name;
                classSelect.appendChild(option);
            });
            classSelect.disabled = false;
        } catch (err) {
            classSelect.innerHTML = `<option value="">Could not load classes</option>`;
        }
    });

    // Navigate to feedback form
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const schoolId = schoolSelect.value;
        const classId = classSelect.value;
        if (!schoolId || !classId) {
            errorEl.textContent = "Select both school and class.";
            return;
        }
        window.location.hash = `#/feedback/${schoolId}/${classId}`;
    });
}

// ==========================================
// FEEDBACK FORM #/feedback/:schoolId/:classId
// ==========================================
export async function renderFeedbackForm(schoolId, classId) {
    root.innerHTML = "";
    renderNavBar(root);

    const wrapper = createElement(root, "div", ["page-wrapper"]);
    const card = createElement(wrapper, "div", ["card", "feedback-card"]);

    // Load class name via Cloud Function (anonymous users can't read Firestore directly)
    let className = "your class";
    try {
        const getClassName = httpsCallable(functions, "getClassName");
        const result = await getClassName({ schoolId, classId });
        className = result.data.name;
    } catch (err) {
        // fallback to generic name
    }

    createElement(card, "h2", [], `Feedback ${className}`);
    createElement(card, "p", ["muted"], "Your message is completely anonymous.");

    const form = createElement(card, "form", []);
    form.addEventListener("submit", (e) => handlePostMessage(e, schoolId, classId));

    // Password
    const passGroup = createElement(form, "div", ["form-group"]);
    createElement(passGroup, "label", [], "Class password");
    createInput(passGroup, "password", "feedback-password", "Enter class password", required);

    // Message
    const msgGroup = createElement(form, "div", ["form-group"]);
    createElement(msgGroup, "label", [], "Your message");
    const textarea = document.createElement("textarea");
    textarea.id = "feedback-message";
    textarea.placeholder = "Write your feedback here...";
    textarea.required = true;
    textarea.maxLength = 500;
    textarea.rows = 5;
    msgGroup.appendChild(textarea);

    // Character counter
    const counter = createElement(msgGroup, "div", ["char-counter"], "0 / 500");
    textarea.addEventListener("input", () => {
        counter.textContent = `${textarea.value.length} / 500`;
    });

    const statusEl = createElement(form, "div", ["error-text"]);
    statusEl.id = "feedback-status";

    const btn = createElement(form, "button", [], "Send feedback");
    btn.type = "submit";

    // "Find another class" link
    const backLink = createElement(card, "p", ["muted"]);
    backLink.innerHTML = `<a href="#/feedback">Find another class</a>`;
}

async function handlePostMessage(e, schoolId, classId) {
    e.preventDefault();
    const password = document.getElementById("feedback-password").value;
    const text = document.getElementById("feedback-message").value;
    const statusEl = document.getElementById("feedback-status");

    if (!password || !text) {
        statusEl.textContent = "Fill in all fields.";
        return;
    }

    statusEl.textContent = "";

    try {
        const postMessage = httpsCallable(functions, "postMessage");
        await postMessage({ schoolId, classId, text, password });

        statusEl.classList.remove("error-text");
        statusEl.classList.add("success-text");
        statusEl.textContent = "Feedback sent!";
        e.target.reset();
        document.querySelector(".char-counter").textContent = "0 / 500";
    } catch (err) {
        statusEl.classList.remove("success-text");
        statusEl.classList.add("error-text");
        if (err.code === "functions/permission-denied") {
            statusEl.textContent = "Wrong password.";
        } else if (err.code === "functions/resource-exhausted") {
            statusEl.textContent = "Wait 1 minute between messages.";
        } else {
            statusEl.textContent = err.message || "Failed to send feedback.";
        }
    }
}