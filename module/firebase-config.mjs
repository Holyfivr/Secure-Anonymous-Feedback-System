import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail }
    from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFunctions, httpsCallable }
    from "https://www.gstatic.com/firebasejs/11.0.0/firebase-functions.js";
import { getFirestore, collection, getDocs, query, doc, getDoc, deleteDoc, where }
    from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";


const firebaseConfig = {
    apiKey: "AIzaSyAOJ2zWs2Gif3ELa-4Ti8PEKOX3q5czZDo",
    authDomain: "safs-a3496.firebaseapp.com",
    projectId: "safs-a3496",
    storageBucket: "safs-a3496.firebasestorage.app",
    messagingSenderId: "960721196233",
    appId: "1:960721196233:web:68e5081ea62a47c576a918"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const functions = getFunctions(app, "europe-west1");
export const db = getFirestore(app);

// Pre-built callable references (avoids recreating on every call)
export const fn = {
    listSchools: httpsCallable(functions, "listSchools"),
    listClasses: httpsCallable(functions, "listClasses"),
    getClassName: httpsCallable(functions, "getClassName"),
    createSchool: httpsCallable(functions, "createSchool"),
    createClass: httpsCallable(functions, "createClass"),
    postMessage: httpsCallable(functions, "postMessage"),
    listMessages: httpsCallable(functions, "listMessages"),
    deleteClass: httpsCallable(functions, "deleteClass"),
    deleteSchool: httpsCallable(functions, "deleteSchool"),
    listClassNames: httpsCallable(functions, "listClassNames"),
    toggleActive: httpsCallable(functions, "toggleActive"),
    resetPostPassword: httpsCallable(functions, "resetPostPassword"),
    resetClassCredentials: httpsCallable(functions, "resetClassCredentials"),
};

// Auth guard — returns token if role matches, otherwise redirects to login
export function requireAuth(role) {
    return new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            unsub();
            if (!user) { window.location.hash = "#/login"; return resolve(null); }
            const token = await user.getIdTokenResult();
            if (token.claims.role !== role) { window.location.hash = "#/login"; return resolve(null); }
            resolve(token);
        });
    });
}

// Escape HTML to prevent XSS when inserting user-supplied text into innerHTML
export function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

// Re-export what the app needs
export {
    signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
    httpsCallable,
    collection, getDocs, query, doc, getDoc, deleteDoc, where,
};