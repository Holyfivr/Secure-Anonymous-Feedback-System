import { createElement } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
import { auth, db, functions, signOut, httpsCallable, requireAuth }
    from "./firebase-config.mjs";

const root = document.getElementById("root");

export async function renderClassadminPage() {
    const token = await requireAuth("classadmin");
    if (!token) return;

    root.innerHTML = "";
    renderNavBar(root);
    renderDashboard(token.claims.schoolId, token.claims.classId);
}

async function renderDashboard(schoolId, classId) {
    const wrapper = createElement(root, "div", ["dashboard"]);

    // Header
    const header = createElement(wrapper, "div", ["dashboard-header"]);
    createElement(header, "h2", [], "Class Rep");
    const logoutBtn = createElement(header, "button", ["btn-danger"], "Log out");
    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
        window.location.hash = "#/login";
    });

    // Load class name
    let className = "your class";
    try {
        const getClassName = httpsCallable(functions, "getClassName");
        const result = await getClassName({ schoolId, classId });
        className = result.data.name;
    } catch (err) { /* fallback */ }

    // Feedback link
    const linkSection = createElement(wrapper, "div", ["card", "dashboard-section"]);
    createElement(linkSection, "h3", [], "Feedback link");
    const feedbackUrl = `${window.location.origin}${window.location.pathname}#/feedback/${schoolId}/${classId}`;
    const urlRow = createElement(linkSection, "div", ["url-row"]);
    const urlText = createElement(urlRow, "code", ["url-text"], feedbackUrl);
    const copyBtn = createElement(urlRow, "button", ["btn-small"], "Copy");
    copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(feedbackUrl);
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
    });
    createElement(linkSection, "p", ["muted"], "Share this link with students so they can send anonymous feedback.");

    // Messages section
    const msgSection = createElement(wrapper, "div", ["card", "dashboard-section"]);
    const msgHeader = createElement(msgSection, "div", ["dashboard-header"]);
    createElement(msgHeader, "h3", [], `Messages — ${className}`);
    const countBadge = createElement(msgHeader, "span", ["badge"], "0");
    countBadge.id = "msg-count";

    const msgList = createElement(msgSection, "div", ["item-list"]);
    msgList.id = "msg-list";

    loadMessages(msgList, schoolId, classId);
}

async function loadMessages(container, schoolId, classId) {
    container.innerHTML = "";
    try {
        const listMessages = httpsCallable(functions, "listMessages");
        const result = await listMessages();
        const messages = result.data;

        const countEl = document.getElementById("msg-count");
        countEl.textContent = messages.length;

        if (messages.length === 0) {
            const placeholder = createElement(container, "p", ["muted"], "No messages yet.");
            placeholder.style.fontStyle = "italic";
            return;
        }

        messages.forEach((msg) => {
            const card = createElement(container, "div", ["message-card"]);

            const msgHeader = createElement(card, "div", ["message-header"]);
            const time = msg.createdAt ? new Date(msg.createdAt) : null;
            const timeStr = time
                ? time.toLocaleDateString("sv-SE") + " " + time.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
                : "Unknown time";
            createElement(msgHeader, "span", ["muted"], timeStr);

            const deleteBtn = createElement(msgHeader, "button", ["btn-danger", "btn-small"], "Delete");
            deleteBtn.addEventListener("click", () => handleDeleteMessage(msg.id, schoolId, classId));

            createElement(card, "p", ["message-text"], msg.text);
        });
    } catch (err) {
        createElement(container, "p", ["error-text"], "Failed to load messages.");
    }
}

async function handleDeleteMessage(messageId, schoolId, classId) {
    if (!confirm("Delete this message?")) return;

    try {
        const { doc, deleteDoc } = await import(
            "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js"
        );
        const msgRef = doc(db, "schools", schoolId, "classes", classId, "messages", messageId);
        await deleteDoc(msgRef);

        const msgList = document.getElementById("msg-list");
        loadMessages(msgList, schoolId, classId);
    } catch (err) {
        alert("Failed to delete message.");
    }
}
