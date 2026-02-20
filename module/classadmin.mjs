import { createElement } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";
import { auth, db, signOut, collection, getDocs, query, requireAuth }
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
        const { doc, getDoc } = await import(
            "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js"
        );
        const classDoc = await getDoc(
            doc(db, "schools", schoolId, "classes", classId)
        );
        if (classDoc.exists() && classDoc.data().name) {
            className = classDoc.data().name;
        }
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
        const { orderBy } = await import(
            "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js"
        );
        const messagesRef = collection(db, "schools", schoolId, "classes", classId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        const countEl = document.getElementById("msg-count");
        countEl.textContent = snapshot.size;

        if (snapshot.empty) {
            const placeholder = createElement(container, "p", ["muted"], "No messages yet.");
            placeholder.style.fontStyle = "italic";
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const card = createElement(container, "div", ["message-card"]);

            const msgHeader = createElement(card, "div", ["message-header"]);
            const time = data.createdAt?.toDate();
            const timeStr = time
                ? time.toLocaleDateString("sv-SE") + " " + time.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
                : "Unknown time";
            createElement(msgHeader, "span", ["muted"], timeStr);

            const deleteBtn = createElement(msgHeader, "button", ["btn-danger", "btn-small"], "Delete");
            deleteBtn.addEventListener("click", () => handleDeleteMessage(docSnap.id, schoolId, classId));

            createElement(card, "p", ["message-text"], data.text);
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
