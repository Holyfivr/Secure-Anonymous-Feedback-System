import { formatElement, createElement, hideSpinner, showSpinner, insertElement, insertNewElement } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
import { fn } from "./firebase-config.mjs";

const root = document.getElementById("root");
const required = true;

// ==========================================
// PICKER PAGE #/feedback
// ==========================================
export async function renderFeedbackPage() {
    root.innerHTML = "";
    renderNavBar(root);

    const wrapper = createElement("div", ["page-wrapper"]);
    const card = createElement("div", ["card", "feedback-card"]);
    const form = createElement("form", ["feedback-picker"]);

    const schoolGroup = createElement("div", ["form-group"]);
    const schoolSelect = createElement("select", []);
    formatElement(schoolSelect, {}, [], { id: "pick-school" });

    const classGroup = createElement("div", ["form-group"]);
    const classSelect = createElement("select", []);
    formatElement(classSelect, {}, [], { id: "pick-class", disabled: true });

    const errorEl = createElement("div", ["error-text"]);
    formatElement(errorEl, {}, [], { id: "picker-error" });

    const btn = createElement("button", [], "Go to feedback form");
    formatElement(btn, {}, [], { type: "submit" });

    insertElement(root, wrapper);
    insertElement(wrapper, card);
    insertNewElement(card, "h2", [], "Send feedback");
    insertNewElement(card, "p", ["muted"], "Find your class to send anonymous feedback.");
    insertElement(card, form);

    insertElement(form, schoolGroup);
    insertNewElement(schoolGroup, "label", [], "School");
    insertElement(schoolGroup, schoolSelect);

    insertElement(form, classGroup);
    insertNewElement(classGroup, "label", [], "Class");
    insertElement(classGroup, classSelect);
    const initialClassOption = createElement("option", [], "Pick a school first");
    formatElement(initialClassOption, {}, [], { value: "" });
    insertElement(classSelect, initialClassOption);

    insertElement(form, errorEl);
    insertElement(form, btn);

    showSpinner(schoolGroup);  

    // Load schools
    try {
        const result = await fn.listSchools();
        hideSpinner(schoolGroup); 
        schoolSelect.replaceChildren();
        const schoolPlaceholder = createElement("option", [], "Select school...");
        formatElement(schoolPlaceholder, {}, [], { value: "" });
        insertElement(schoolSelect, schoolPlaceholder);
        result.data.forEach((school) => {
            const option = createElement("option", [], school.name);
            formatElement(option, {}, [], { value: school.id });
            insertElement(schoolSelect, option);
        });
    } catch (err) {
        hideSpinner(schoolGroup);
        schoolSelect.replaceChildren();
        const schoolErrorOption = createElement("option", [], "Could not load schools");
        formatElement(schoolErrorOption, {}, [], { value: "" });
        insertElement(schoolSelect, schoolErrorOption);
    }

    // When school is selected, load classes
    schoolSelect.addEventListener("change", async () => {
        const schoolId = schoolSelect.value;
        formatElement(classSelect, {}, [], { disabled: true });
        hideSpinner(classGroup);
        showSpinner(classGroup);


        if (!schoolId) {
            classSelect.replaceChildren();
            const noSchoolOption = createElement("option", [], "Pick a school first");
            formatElement(noSchoolOption, {}, [], { value: "" });
            insertElement(classSelect, noSchoolOption);
            hideSpinner(classGroup);
            return;
        }

        try {
            const result = await fn.listClasses({ schoolId });
            hideSpinner(classGroup);
            classSelect.replaceChildren();
            const classPlaceholder = createElement("option", [], "Select class...");
            formatElement(classPlaceholder, {}, [], { value: "" });
            insertElement(classSelect, classPlaceholder);
            result.data.forEach((cls) => {
                const option = createElement("option", [], cls.name);
                formatElement(option, {}, [], { value: cls.id });
                insertElement(classSelect, option);
            });
            formatElement(classSelect, {}, [], { disabled: false });
        } catch (err) {
            hideSpinner(classGroup);
            classSelect.replaceChildren();
            const classErrorOption = createElement("option", [], "Could not load classes");
            formatElement(classErrorOption, {}, [], { value: "" });
            insertElement(classSelect, classErrorOption);
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

    const wrapper = createElement("div", ["page-wrapper"]);
    const card = createElement("div", ["card", "feedback-card"]);
    const heading = createElement("h2", [], "Feedback");

    insertElement(root, wrapper);
    insertElement(wrapper, card);
    insertElement(card, heading);
    insertNewElement(card, "p", ["muted"], "Your message is completely anonymous.");

    // Build the form immediately; fetch class name in background
    const form = createElement("form", []);
    insertElement(card, form);
    form.addEventListener("submit", (e) => handlePostMessage(e, schoolId, classId));

    // Password
    const passGroup = createElement("div", ["form-group"]);
    insertElement(form, passGroup);

    insertNewElement(passGroup, "label", [], "Class password");
    const passwordInput = createElement("input");
    formatElement(passwordInput, {}, [], { type: "password", id: "feedback-password", placeholder: "Enter class password", required });
    insertElement(passGroup, passwordInput);

    // Message
    const msgGroup = createElement("div", ["form-group"]);
    insertElement(form, msgGroup);
    insertNewElement(msgGroup, "label", [], "Your message");
    const textArea = createElement("textarea");
    formatElement(textArea, {}, [], { id: "feedback-message", placeholder: "Type your feedback here...", required: true, maxLength: 500, rows: 5 });
    insertElement(msgGroup, textArea);


    // Character counter
    const counter = createElement("div", ["char-counter"], "0 / 500");
    insertElement(msgGroup, counter);
    textArea.addEventListener("input", () => {
        counter.textContent = `${textArea.value.length} / 500`;
    });

    const statusEl = createElement("div", ["error-text"]);
    formatElement(statusEl, {}, [], { id: "feedback-status" });
    insertElement(form, statusEl);

    const btn = createElement("button", [], "Send feedback");
    formatElement(btn, {}, [], { type: "submit" });
    insertElement(form, btn);

    // Load class name in background (non-blocking — form is already usable)
    fn.getClassName({ schoolId, classId })
        .then(result => { heading.textContent = `Feedback ${result.data.name}`; })
        .catch(() => { /* keep generic heading */ });
}

async function handlePostMessage(e, schoolId, classId) {
    e.preventDefault();
    const password = document.getElementById("feedback-password").value;
    const text = document.getElementById("feedback-message").value;
    const feedbackStatus = document.getElementById("feedback-status");

    if (!password || !text) {
        feedbackStatus.textContent = "Fill in all fields.";
        return;
    }

    feedbackStatus.textContent = "";

    try {
        await fn.postMessage({ schoolId, classId, text, password });

        feedbackStatus.classList.remove("error-text");
        feedbackStatus.classList.add("success-text");
        feedbackStatus.textContent = "Feedback sent!";
        e.target.reset();
        document.querySelector(".char-counter").textContent = "0 / 500";
    } catch (err) {
        feedbackStatus.classList.remove("success-text");
        feedbackStatus.classList.add("error-text");
        if (err.code === "functions/permission-denied") {
            feedbackStatus.textContent = "Wrong password.";
        } else if (err.code === "functions/resource-exhausted") {
            feedbackStatus.textContent = "Wait 1 minute between messages.";
        } else {
            feedbackStatus.textContent = err.message || "Failed to send feedback.";
        }
    }
}