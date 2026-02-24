import { createElement, showSpinner, hideSpinner, insertElement, addNewElement, formatElement } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
import { auth, db, signOut, fn, requireAuth, doc, getDoc, deleteDoc }
    from "./firebase-config.mjs";


/* Class Admin Dashboard (URL: #/classadmin) */

// Root div for the index.html page
const root = document.getElementById("root");

/* Renders the class admin dashboard view */
export async function renderClassadminPage() {
    // Check auth and role first - if not authenticated or wrong role, requireAuth will redirect to Login and return null
    const token = await requireAuth("classadmin");
    if (!token) return;
    root.innerHTML = "";
    renderNavBar    (root, true);
    renderDashboard (token.claims.schoolId, token.claims.classId);
}

/* Renders the main dashboard view, including the feedback link, password reset, and messages list */
async function renderDashboard(schoolId, classId) {
    
    /* HEADER SECTION */
    const wrapper       = createElement("div", ["dashboard"]);
    const header        = createElement("div", ["dashboard-header"]);
    
    insertElement       (root, wrapper);
    insertElement       (wrapper, header);

    /* LINK SECTION */
    const linkSection   = createElement("div", ["card", "dashboard-section"]);
    const feedbackUrl   = `${window.location.origin}${window.location.pathname}#/feedback/${schoolId}/${classId}`;
    const urlRow        = createElement("div", ["url-row"]);
    const copyBtn       = createElement("button", ["btn-small"], "Copy");

    insertElement       (wrapper, linkSection);
    addNewElement    (linkSection, "h3", [], "Feedback link");
    insertElement       (linkSection, urlRow);
    addNewElement    (urlRow, "code", ["url-text"], feedbackUrl);
    formatElement       (copyBtn, {}, [], { type: "button" });
    insertElement       (urlRow, copyBtn);
    addNewElement    (linkSection, "p", ["muted"], "Share this link with students so they can send anonymous feedback.");
    enableCopyBtn       (copyBtn, feedbackUrl);
   

    /* PASSWORD RESET SECTION */
    const resetPasswordSection  = createElement("div", ["card", "dashboard-section"]);
    const resetHeader           = createElement("div", ["dashboard-header"]);
    const resetInput            = createElement("input", ["input-small", "reset-post-password"]);
    const resetBtn              = createElement("button", ["btn-small"], "Reset");

    insertElement       (wrapper, resetPasswordSection);
    insertElement       (resetPasswordSection, resetHeader);
    addNewElement    (resetHeader, "p", [], "Reset feedback password");
    formatElement       (resetInput, {}, [], { type: "text" });
    insertElement       (resetHeader, resetInput);
    formatElement       (resetBtn, {}, [], { type: "button" });
    insertElement       (resetHeader, resetBtn);
    enableResetBtn      (resetBtn, resetInput, resetPasswordSection);




    /* MESSAGES SECTION */
    const msgSection    = createElement("div", ["card", "dashboard-section"]);
    const msgHeader     = createElement("div", ["dashboard-header"]);
    const msgTitle      = createElement("h3", [], "Messages");
    const countBadge    = createElement("span", ["badge"], "…");
    const msgList       = createElement("div", ["item-list"]);
    
    insertElement       (wrapper, msgSection);
    insertElement       (msgSection, msgHeader);
    insertElement       (msgHeader, msgTitle);
    formatElement       (countBadge, {}, [], { id: "msg-count" });
    insertElement       (msgHeader, countBadge);
    formatElement       (msgList, {}, [], { id: "msg-list" });
    insertElement       (msgSection, msgList);
    showSpinner         (msgList);

    // Load class name (direct Firestore read) + messages (Cloud Function)
    const [className] = await Promise.all([
        getDoc(doc(db, "schools", schoolId, "classes", classId))
            .then(snap => snap.exists() ? snap.data().name : "your class")
            .catch(() => "your class"),
        loadMessages(msgList, schoolId, classId),
    ]);

    msgTitle.textContent = `Messages — ${className}`;
}

/* Loads messages from the server and renders them in the dashboard */
async function loadMessages(container, schoolId, classId) {
    container.innerHTML = "";
    showSpinner(container);

    try {
        const result        = await fn.listMessages();
        const messages      = result.data;
        const counter       = document.getElementById("msg-count");
        counter.textContent = messages.length;

        hideSpinner(container);

        if (messages.length === 0) {

            const placeholder = createElement("p", ["muted"], "No messages yet.");
            insertElement(container, placeholder);
            formatElement(placeholder, { fontStyle: "italic" });
            return;
        }

        messages.forEach((msg) => {
            renderMessageCard(container, msg, schoolId, classId);
        });
    } catch (err) {
        const error = createElement("p", ["error-text"], "Failed to load messages.");
        hideSpinner(container);
        insertElement(container, error);
        console.error("Error loading messages:", err);
    }
}

/* Renders a single message card in the messages list */
function renderMessageCard(container, msg, schoolId, classId) {

    const card      = createElement("div", ["message-card"]);
    const msgHeader = createElement("div", ["message-header"]);
    const deleteBtn = createElement("button", ["btn-danger", "btn-small"], "Delete");
    const time      = msg.createdAt ? new Date(msg.createdAt) : null;
    const timeStr   = time
                    ? time.toLocaleDateString("sv-SE") + " " + time.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
                    : "Unknown time";
    card.dataset.messageId = msg.id;
    
    insertElement       (container, card);
    insertElement       (card, msgHeader);
    addNewElement    (msgHeader, "span", ["muted"], timeStr);
    formatElement       (deleteBtn, {}, [], { type: "button" });
    insertElement       (msgHeader, deleteBtn);
    enableDeleteBtn     (deleteBtn, msg.id, card, schoolId, classId);
    addNewElement    (card, "p", ["message-text"], msg.text);
}

/* Handles the deletion of a message, including optimistic UI update and error handling */
async function handleDeleteMessage(messageId, card, schoolId, classId) {
    if (!confirm("Delete this message?")) return; // Confirmation dialog before deletion

    // Optimistic UI: remove from DOM immediately
    card.style.opacity = "0.4";
    card.style.pointerEvents = "none";

    try {
        const msgRef = doc(db, "schools", schoolId, "classes", classId, "messages", messageId);
        await deleteDoc(msgRef);

        card.remove();

        // Update count
        const counter   = document.getElementById("msg-count");
        const remaining = document.querySelectorAll("#msg-list .message-card").length;
        counter.textContent = remaining;

        if (remaining === 0) {
            const msgList = document.getElementById("msg-list");
            const placeholder = createElement("p", ["muted"], "No messages yet.");
            insertElement(msgList, placeholder);
            formatElement(placeholder, { fontStyle: "italic" });
        }
    } catch (err) {
        // Revert optimistic UI on failure
        console.error("Failed to delete message:", err);
        card.style.opacity = "1";
        card.style.pointerEvents = "auto";
        alert("Failed to delete message.");
    }
}

/* Enables the copy button functionality to copy the feedback URL to clipboard and show feedback */
function enableCopyBtn(copyBtn, feedbackUrl) {

    copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(feedbackUrl);
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
    });
}

/* Enables the reset button functionality to reset the feedback password via Cloud Function and show feedback */
function enableResetBtn(resetBtn, resetInput, resetPasswordSection) {

    resetBtn.addEventListener("click", async () => {
        const newPassword = resetInput.value.trim();
        if (!newPassword) {
            alert("Please enter a new feedback password.");
            return;
        }
        try {
            await fn.resetFeedbackPassword({ newFeedbackPassword: newPassword });
            alert("Feedback password reset successfully.");
            resetInput.value = "";
            addNewElement(resetPasswordSection, "p", [], "Feedback password has been changed.");
            addNewElement(resetPasswordSection, "p", [], `New password: ${newPassword}.`);
            addNewElement(resetPasswordSection, "p", [], "Share this password with your classmates.");

        } catch (err) {
            console.error("Error resetting feedback password:", err);
            alert("Failed to reset feedback password.");
        }
    });
}

/* Enables the delete button for a message card, calling the handleDeleteMessage function on click */
function enableDeleteBtn(deleteBtn, messageId, card, schoolId, classId) {
    deleteBtn.addEventListener("click", () => handleDeleteMessage(messageId, card, schoolId, classId));
}