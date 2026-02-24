import { createElement, showSpinner, hideSpinner } from "./dom-helper.mjs";
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
    const wrapper = createElement(root, "div", ["dashboard"]);

    // Header
    const header = createElement(wrapper, "div", ["dashboard-header"]);
    createElement(header, "h2", [], "Class Rep");

    // Feedback link (renders instantly, no server call)
    const linkSection = createElement(wrapper, "div", ["card", "dashboard-section"]);
    createElement(linkSection, "h3", [], "Feedback link");
    const feedbackUrl = `${window.location.origin}${window.location.pathname}#/feedback/${schoolId}/${classId}`;
    const urlRow = createElement(linkSection, "div", ["url-row"]);
    createElement(urlRow, "code", ["url-text"], feedbackUrl);
    const copyBtn = createElement(urlRow, "button", ["btn-small"], "Copy");
    copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(feedbackUrl);
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
    });
    createElement(linkSection, "p", ["muted"], "Share this link with students so they can send anonymous feedback.");
   
   
    const resetPasswordSection = createElement(wrapper, "div", ["card", "dashboard-section"]);
    const resetHeader = createElement(resetPasswordSection, "div", ["dashboard-header"]);
    createElement(resetHeader, "p", [], "Reset feedback password");
    createElement(resetHeader, "input", ["input-small", "reset-post-password"], "");
    const resetBtn = createElement(resetHeader, "button", ["btn-small"], "Reset");
    resetBtn.addEventListener("click", async () => {
        const newPassword = resetHeader.querySelector(".reset-post-password").value.trim();
        if (!newPassword) {
            alert("Please enter a new feedback password.");
            return;
        }
        try {
            await fn.resetFeedbackPassword({ newFeedbackPassword: newPassword });
            alert("Feedback password reset successfully.");
            resetHeader.querySelector(".reset-post-password").value = "";
            createElement(resetPasswordSection, "p", [], "Feedback password has been changed.");
            createElement(resetPasswordSection, "p", [], `New password: ${newPassword}.`);
            createElement(resetPasswordSection, "p", [], "Share this password with your classmates.");

        } catch (err) {
            console.error("Error resetting feedback password:", err);
            alert("Failed to reset feedback password.");
        }
    });


    // Messages section (with loading indicator)
    const msgSection = createElement(wrapper, "div", ["card", "dashboard-section"]);
    const msgHeader = createElement(msgSection, "div", ["dashboard-header"]);
    const msgTitle = createElement(msgHeader, "h3", [], "Messages");
    const countBadge = createElement(msgHeader, "span", ["badge"], "…");
    countBadge.id = "msg-count";

    const msgList = createElement(msgSection, "div", ["item-list"]);
    msgList.id = "msg-list";
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
            const placeholder = createElement(container, "p", ["muted"], "No messages yet.");
            placeholder.style.fontStyle = "italic";
            return;
        }

        messages.forEach((msg) => {
            renderMessageCard(container, msg, schoolId, classId);
        });
    } catch (err) {
        hideSpinner(container);
        createElement(container, "p", ["error-text"], "Failed to load messages.");
        console.error("Error loading messages:", err);
    }
}

function renderMessageCard(container, msg, schoolId, classId) {
    const card = createElement(container, "div", ["message-card"]);
    card.dataset.messageId = msg.id;

    const msgHeader = createElement(card, "div", ["message-header"]);
    const time = msg.createdAt ? new Date(msg.createdAt) : null;
    const timeStr = time
        ? time.toLocaleDateString("sv-SE") + " " + time.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
        : "Unknown time";
    createElement(msgHeader, "span", ["muted"], timeStr);

    const deleteBtn = createElement(msgHeader, "button", ["btn-danger", "btn-small"], "Delete");
    deleteBtn.addEventListener("click", () => handleDeleteMessage(msg.id, card, schoolId, classId));

    createElement(card, "p", ["message-text"], msg.text);
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
            const placeholder = createElement(msgList, "p", ["muted"], "No messages yet.");
            placeholder.style.fontStyle = "italic";
        }
    } catch (err) {
        // Revert optimistic UI on failure
        console.error("Failed to delete message:", err);
        cardEl.style.opacity = "1";
        cardEl.style.pointerEvents = "auto";
        alert("Failed to delete message.");
    }
}
