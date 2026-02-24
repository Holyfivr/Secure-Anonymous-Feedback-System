import { createElement, showSpinner, hideSpinner, insertElement, insertNewElement, formatElement } from "./dom-helper.mjs";
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

    // Clears the page
    root.innerHTML = "";
    // Renders the nav bar
    renderNavBar(root, true);
    renderDashboard(token.claims.schoolId, token.claims.classId);
}

async function renderDashboard(schoolId, classId) {
    const wrapper = createElement("div", ["dashboard"]);
    insertElement(root, wrapper);

    // Header
    const header = createElement("div", ["dashboard-header"]);
    insertElement(wrapper, header);
    insertNewElement(header, "h2", [], "Class Rep");

    // Feedback link (renders instantly, no server call)
    const linkSection = createElement("div", ["card", "dashboard-section"]);
    insertElement(wrapper, linkSection);
    insertNewElement(linkSection, "h3", [], "Feedback link");

    const feedbackUrl = `${window.location.origin}${window.location.pathname}#/feedback/${schoolId}/${classId}`;
    const urlRow = createElement("div", ["url-row"]);
    insertElement(linkSection, urlRow);
    insertNewElement(urlRow, "code", ["url-text"], feedbackUrl);

    const copyBtn = createElement("button", ["btn-small"], "Copy");
    formatElement(copyBtn, {}, [], { type: "button" });
    insertElement(urlRow, copyBtn);

    copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(feedbackUrl);
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
    });
    insertNewElement(linkSection, "p", ["muted"], "Share this link with students so they can send anonymous feedback.");
   
   
    const resetPasswordSection = createElement("div", ["card", "dashboard-section"]);
    insertElement(wrapper, resetPasswordSection);

    const resetHeader = createElement("div", ["dashboard-header"]);
    insertElement(resetPasswordSection, resetHeader);
    insertNewElement(resetHeader, "p", [], "Reset feedback password");

    const resetInput = createElement("input", ["input-small", "reset-post-password"]);
    formatElement(resetInput, {}, [], { type: "text" });
    insertElement(resetHeader, resetInput);

    const resetBtn = createElement("button", ["btn-small"], "Reset");
    formatElement(resetBtn, {}, [], { type: "button" });
    insertElement(resetHeader, resetBtn);

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
            insertNewElement(resetPasswordSection, "p", [], "Feedback password has been changed.");
            insertNewElement(resetPasswordSection, "p", [], `New password: ${newPassword}.`);
            insertNewElement(resetPasswordSection, "p", [], "Share this password with your classmates.");

        } catch (err) {
            console.error("Error resetting feedback password:", err);
            alert("Failed to reset feedback password.");
        }
    });


    // Messages section (with loading indicator)
    const msgSection = createElement("div", ["card", "dashboard-section"]);
    insertElement(wrapper, msgSection);

    const msgHeader = createElement("div", ["dashboard-header"]);
    insertElement(msgSection, msgHeader);

    const msgTitle = createElement("h3", [], "Messages");
    insertElement(msgHeader, msgTitle);

    const countBadge = createElement("span", ["badge"], "…");
    formatElement(countBadge, {}, [], { id: "msg-count" });
    insertElement(msgHeader, countBadge);

    const msgList = createElement("div", ["item-list"]);
    formatElement(msgList, {}, [], { id: "msg-list" });
    insertElement(msgSection, msgList);
    showSpinner(msgList);

    // Load class name (direct Firestore read) + messages (Cloud Function) IN PARALLEL
    const [className] = await Promise.all([
        getDoc(doc(db, "schools", schoolId, "classes", classId))
            .then(snap => snap.exists() ? snap.data().name : "your class")
            .catch(() => "your class"),
        loadMessages(msgList, schoolId, classId),
    ]);

    msgTitle.textContent = `Messages — ${className}`;
}

async function loadMessages(container, schoolId, classId) {
    container.innerHTML = "";
    showSpinner(container);

    try {
        const result = await fn.listMessages();
        const messages = result.data;

        hideSpinner(container);

        const countEl = document.getElementById("msg-count");
        countEl.textContent = messages.length;

        if (messages.length === 0) {
            const placeholder = insertNewElement(container, "p", ["muted"], "No messages yet.");
            formatElement(placeholder, { fontStyle: "italic" });
            return;
        }

        messages.forEach((msg) => {
            renderMessageCard(container, msg, schoolId, classId);
        });
    } catch (err) {
        hideSpinner(container);
        insertNewElement(container, "p", ["error-text"], "Failed to load messages.");
        console.error("Error loading messages:", err);
    }
}

function renderMessageCard(container, msg, schoolId, classId) {
    const card = createElement("div", ["message-card"]);
    insertElement(container, card);
    card.dataset.messageId = msg.id;

    const msgHeader = createElement("div", ["message-header"]);
    insertElement(card, msgHeader);
    const time = msg.createdAt ? new Date(msg.createdAt) : null;
    const timeStr = time
        ? time.toLocaleDateString("sv-SE") + " " + time.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
        : "Unknown time";
    insertNewElement(msgHeader, "span", ["muted"], timeStr);

    const deleteBtn = createElement("button", ["btn-danger", "btn-small"], "Delete");
    formatElement(deleteBtn, {}, [], { type: "button" });
    insertElement(msgHeader, deleteBtn);
    deleteBtn.addEventListener("click", () => handleDeleteMessage(msg.id, card, schoolId, classId));

    insertNewElement(card, "p", ["message-text"], msg.text);
}

async function handleDeleteMessage(messageId, cardEl, schoolId, classId) {
    if (!confirm("Delete this message?")) return;

    // Optimistic UI: remove from DOM immediately
    cardEl.style.opacity = "0.4";
    cardEl.style.pointerEvents = "none";

    try {
        const msgRef = doc(db, "schools", schoolId, "classes", classId, "messages", messageId);
        await deleteDoc(msgRef);

        cardEl.remove();

        // Update count
        const countEl = document.getElementById("msg-count");
        const remaining = document.querySelectorAll("#msg-list .message-card").length;
        countEl.textContent = remaining;

        if (remaining === 0) {
            const msgList = document.getElementById("msg-list");
            const placeholder = insertNewElement(msgList, "p", ["muted"], "No messages yet.");
            formatElement(placeholder, { fontStyle: "italic" });
        }
    } catch (err) {
        // Revert optimistic UI on failure
        console.error("Failed to delete message:", err);
        cardEl.style.opacity = "1";
        cardEl.style.pointerEvents = "auto";
        alert("Failed to delete message.");
    }
}
