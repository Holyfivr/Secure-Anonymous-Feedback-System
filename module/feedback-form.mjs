import { formatElement, createElement, hideSpinner, showSpinner, insertElement, addNewElement } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
import { fn } from "./firebase-config.mjs";

const root = document.getElementById("root");
const required = true;

/* ========================================== */
/*          PICKER PAGE #/feedback            */
/* ========================================== */
export async function renderFeedbackPage() {
    root.innerHTML = "";
    renderNavBar(root);

    const wrapper               = createElement("div", ["page-wrapper"]);
    const card                  = createElement("div", ["card", "feedback-card"]);
    const form                  = createElement("form", ["feedback-picker"]);
    const schoolGroup           = createElement("div", ["form-group"]);
    const schoolSelect          = createElement("select", []);
    const classGroup            = createElement("div", ["form-group"]);
    const classSelect           = createElement("select", []);
    const error                 = createElement("div", ["error-text"]);
    const btn                   = createElement("button", [], "Go to feedback form");
    const initialClassOption    = createElement("option", [], "Pick a school first");

    /* Format elements */
    formatElement               (schoolSelect, {}, [], { id: "pick-school" });
    formatElement               (classSelect, {}, [], { id: "pick-class", disabled: true });
    formatElement               (error, {}, [], { id: "picker-error" });
    formatElement               (btn, {}, [], { type: "submit" });

    /* Form Container */
    insertElement               (root, wrapper);
    insertElement               (wrapper, card);
    addNewElement               (card, "h2", [], "Send feedback");
    addNewElement               (card, "p", ["muted"], "Find your class to send anonymous feedback.");
    insertElement               (card, form);

    /* School select */
    insertElement               (form, schoolGroup);
    addNewElement               (schoolGroup, "label", [], "School");
    insertElement               (schoolGroup, schoolSelect);

    /* Class select */
    insertElement               (form, classGroup);
    addNewElement               (classGroup, "label", [], "Class");
    insertElement               (classGroup, classSelect);
    formatElement               (initialClassOption, {}, [], { value: "" });
    insertElement               (classSelect, initialClassOption);

    /* Error message and submit button */
    insertElement               (form, error);
    insertElement               (form, btn);

    showSpinner                 (schoolGroup);  

    /* Load schools */
    loadSchools(schoolGroup, schoolSelect, error);
    /* Load classes when a school is selected */
    loadClasses(schoolSelect, classGroup, classSelect, error);

    /* Navigate to feedback form */
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const schoolId          = schoolSelect.value;
        const classId           = classSelect.value;

        if (!schoolId || !classId) {
            error.textContent   = "Select both school and class.";
            return;
        }
        window.location.hash    = `#/feedback/${schoolId}/${classId}`;
    });
}

/* =========================================== */
/* FEEDBACK FORM #/feedback/:schoolId/:classId */
/* =========================================== */
export async function renderFeedbackForm(schoolId, classId) {

    root.innerHTML = "";
    renderNavBar(root);

    /* Create frame and form */
    const wrapper       = createElement("div", ["page-wrapper"]);
    const card          = createElement("div", ["card", "feedback-card"]);
    const heading       = createElement("h2", [], "Feedback: ");
    const form          = createElement("form", []);

    insertElement       (root, wrapper);
    insertElement       (wrapper, card);
    insertElement       (card, heading);
    addNewElement       (card, "p", ["muted"], "Your message is completely anonymous.");

    /* Build the form immediately; fetch class name in background */
    insertElement       (card, form);

    form.addEventListener("submit", (e) => handlePostMessage(e, schoolId, classId));

    /* Password section */
    const passGroup     = createElement("div", ["form-group"]);
    const passwordInput = createElement("input");

    insertElement       (form, passGroup);
    addNewElement       (passGroup, "label", [], "Class password");
    formatElement       (passwordInput, {}, [], { type: "password", id: "feedback-password", placeholder: "Enter class password", required });
    insertElement       (passGroup, passwordInput);

    /* Message section */
    const msgGroup      = createElement("div", ["form-group"]);
    const textArea      = createElement("textarea");

    insertElement       (form, msgGroup);
    addNewElement       (msgGroup, "label", [], "Your message");
    formatElement       (textArea, {}, [], { id: "feedback-message", placeholder: "Type your feedback here...", required: true, maxLength: 500, rows: 5 });
    insertElement       (msgGroup, textArea);

    /* Footer section */
    const counter       = createElement("div", ["char-counter"], "0 / 500");
    const status        = createElement("div", ["error-text"]);
    const btn           = createElement("button", [], "Send feedback");
    
    /* Counter */
    insertElement       (msgGroup, counter);
    textArea.addEventListener("input", () => {
        counter.textContent = `${textArea.value.length} / 500`;
    });
    
    /* Status message */
    formatElement       (status, {}, [], { id: "feedback-status" });
    insertElement       (form, status);
    
    /* Submit button */
    formatElement       (btn, {}, [], { type: "submit" });
    insertElement       (form, btn);

    /* Load class name in background (non-blocking — form is already usable) */
    fn.getClassName     ({ schoolId, classId })
        .then           (result => { heading.textContent = `Feedback ${result.data.name}`; })
        .catch          (() => { /* keep generic heading */ });
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
        const normalizedMessage = String(err?.message || "").toLowerCase();
        feedbackStatus.classList.remove("success-text");
        feedbackStatus.classList.add("error-text");
        if (err.code === "functions/permission-denied") {
            feedbackStatus.textContent = "Wrong password.";
        } else if (err.code === "functions/resource-exhausted") {
            if (normalizedMessage.includes("too many attempts") || normalizedMessage.includes("20 minutes")) {
                feedbackStatus.textContent = "Too many attempts. Try again in 20 minutes.";
            } else {
                feedbackStatus.textContent = "Wait 1 minute between messages.";
            }
        } else {
            feedbackStatus.textContent = err.message || "Failed to send feedback.";
        }
    }
}


/* ========================================== */
/*                HELPER FUNCTIONS            */
/* ========================================== */

/* Loads schools into the school select dropdown. */
async function loadSchools(schoolGroup, schoolSelect, pickerError) {
     try {
        // Clear previous picker errors before new load
        if (pickerError) pickerError.textContent = "";
        const result = await fn.listSchools();
        const schoolPlaceholder = createElement("option", [], "Select school...");

        hideSpinner             (schoolGroup);       
        schoolSelect.replaceChildren(); 

        formatElement           (schoolPlaceholder, {}, [], { value: "" });
        insertElement           (schoolSelect, schoolPlaceholder);

        result.data.forEach((school) => {
            const option        = createElement("option", [], school.name);
            formatElement       (option, {}, [], { value: school.id });
            insertElement       (schoolSelect, option);
        });
    } catch (err) {
        try {
            hideSpinner             (schoolGroup);
            schoolSelect.replaceChildren();

            const schoolErrorOption = createElement("option", [], "Could not load schools");
            formatElement           (schoolErrorOption, {}, [], { value: "" });
            insertElement           (schoolSelect, schoolErrorOption);

            if (isRequestBlocked(err) && pickerError) {
                pickerError.textContent = "Unusual amount of requests detected. Functionality is temporarily blocked for 10 minutes.";
            } else if (pickerError) {
                pickerError.textContent = "Could not load schools right now.";
            }
        } catch {
            /* no-op */
        }
    }
}

/* Loads classes for the selected school into the class select dropdown. */
async function loadClasses(schoolSelect, classGroup, classSelect, pickerError) {
    schoolSelect.addEventListener("change", async () => {
        const schoolId          = schoolSelect.value;
        formatElement           (classSelect, {}, [], { disabled: true });
        hideSpinner             (classGroup);
        showSpinner             (classGroup);
        if (pickerError) pickerError.textContent = "";


        if (!schoolId) {
            classSelect.replaceChildren();
            const noSchoolOption = createElement("option", [], "Pick a school first");
            formatElement       (noSchoolOption, {}, [], { value: "" });
            insertElement       (classSelect, noSchoolOption);
            hideSpinner         (classGroup);
            return;
        }

        try {
            const result            = await fn.listClasses({ schoolId });
            const classPlaceholder  = createElement("option", [], "Select class...");

            hideSpinner         (classGroup);
            classSelect.replaceChildren();

            formatElement       (classPlaceholder, {}, [], { value: "" });
            insertElement       (classSelect, classPlaceholder);
            result.data.forEach ((classRoom) => {
                const option    = createElement("option", [], classRoom.name);
                formatElement   (option, {}, [], { value: classRoom.id });
                insertElement   (classSelect, option);
            });
            formatElement       (classSelect, {}, [], { disabled: false });

        } catch (err) {
            hideSpinner         (classGroup);
            classSelect.replaceChildren();

            const classErrorOption = createElement("option", [], "Could not load classes");
            formatElement       (classErrorOption, {}, [], { value: "" });
            insertElement       (classSelect, classErrorOption);

            if (isRequestBlocked(err) && pickerError) {
                pickerError.textContent = "Unusual amount of requests detected. Functionality is temporarily blocked for 10 minutes.";
            } else if (pickerError) {
                pickerError.textContent = "Could not load classes right now.";
            }
        }
    });
}

function isRequestBlocked(err) {
    const message = String(err?.message || "").toLowerCase();
    return err?.code === "functions/resource-exhausted" || message.includes("too many requests");
}
