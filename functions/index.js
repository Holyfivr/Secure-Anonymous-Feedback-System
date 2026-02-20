/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

// --- Helper: check caller role ---
function requireRole(context, role) {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }
  if (context.auth.token.role !== role) {
    throw new HttpsError("permission-denied", `Requires ${role} role.`);
  }
}

// ===========================================
// CREATE SCHOOL (superadmin only)
// ===========================================
exports.createSchool = onCall(async (request) => {
  requireRole(request, "superadmin");

  const {schoolName, adminEmail, adminPassword} = request.data;

  if (!schoolName || !adminEmail || !adminPassword) {
    throw new HttpsError("invalid-argument", "Missing fields.");
  }
  if (adminPassword.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be 6+ characters.");
  }

  // Create the school admin user
  let userRecord;
  try {
    userRecord = await getAuth().createUser({
      email: adminEmail,
      password: adminPassword,
    });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "That email is already in use.");
    }
    if (err.code === "auth/invalid-email") {
      throw new HttpsError("invalid-argument", "Invalid email address.");
    }
    if (err.code === "auth/invalid-password") {
      throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
    }
    throw new HttpsError("internal", "Could not create user: " + err.message);
  }

  // Create school document
  const schoolRef = db.collection("schools").doc();
  await schoolRef.set({
    name: schoolName,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Set custom claims with schoolId
  await getAuth().setCustomUserClaims(userRecord.uid, {
    role: "schooladmin",
    schoolId: schoolRef.id,
  });

  return {schoolId: schoolRef.id, adminUid: userRecord.uid};
});

// ===========================================
// CREATE CLASS (school admin only)
// ===========================================
exports.createClass = onCall(async (request) => {
  requireRole(request, "schooladmin");

  const schoolId = request.auth.token.schoolId;
  const {className, adminEmail, adminPassword, postPassword} = request.data;

  if (!className || !adminEmail || !adminPassword || !postPassword) {
    throw new HttpsError("invalid-argument", "Missing fields.");
  }

  // Hash the post password (SHA-256)
  const crypto = require("crypto");
  const postPasswordHash = crypto.createHash("sha256").update(postPassword).digest("hex");

  // Create class admin user
  let userRecord;
  try {
    userRecord = await getAuth().createUser({
      email: adminEmail,
      password: adminPassword,
    });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "That email is already in use.");
    }
    if (err.code === "auth/invalid-email") {
      throw new HttpsError("invalid-argument", "Invalid email address.");
    }
    if (err.code === "auth/invalid-password") {
      throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
    }
    throw new HttpsError("internal", "Could not create user: " + err.message);
  }

  // Create class document
  const classRef = db.collection("schools").doc(schoolId).collection("classes").doc();
  await classRef.set({
    name: className,
    active: true,
    postPasswordHash: postPasswordHash,
    adminUid: userRecord.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Set custom claims
  await getAuth().setCustomUserClaims(userRecord.uid, {
    role: "classadmin",
    schoolId: schoolId,
    classId: classRef.id,
  });

  return {classId: classRef.id, adminUid: userRecord.uid};
});

// ===========================================
// POST MESSAGE (anonymous, rate-limited)
// ===========================================
exports.postMessage = onCall(async (request) => {
  const {schoolId, classId, text, password} = request.data;

  if (!schoolId || !classId || !text || !password) {
    throw new HttpsError("invalid-argument", "Missing fields.");
  }
  if (text.length > 500) {
    throw new HttpsError("invalid-argument", "Message too long (max 500 chars).");
  }

  // Get class document
  const classRef = db.collection("schools").doc(schoolId).collection("classes").doc(classId);
  const classDoc = await classRef.get();

  if (!classDoc.exists || !classDoc.data().active) {
    throw new HttpsError("not-found", "Class not found or inactive.");
  }

  // Verify post password
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  if (hash !== classDoc.data().postPasswordHash) {
    throw new HttpsError("permission-denied", "Wrong password.");
  }

  // Rate limit: check last message timestamp
  const messagesRef = classRef.collection("messages");
  const recent = await messagesRef.orderBy("createdAt", "desc").limit(1).get();
  if (!recent.empty) {
    const lastTime = recent.docs[0].data().createdAt?.toMillis() || 0;
    if (Date.now() - lastTime < 60000) {
      throw new HttpsError("resource-exhausted", "Wait 1 minute between messages.");
    }
  }

  // Write message
  await messagesRef.add({
    text: text,
    createdAt: FieldValue.serverTimestamp(),
  });

  return {status: "ok"};
});

// ===========================================
// DELETE CLASS (school admin only)
// ===========================================
exports.deleteClass = onCall(async (request) => {
  requireRole(request, "schooladmin");

  const schoolId = request.auth.token.schoolId;
  const {classId} = request.data;

  if (!classId) {
    throw new HttpsError("invalid-argument", "Missing classId.");
  }

  const classRef = db.collection("schools").doc(schoolId).collection("classes").doc(classId);
  const classDoc = await classRef.get();

  if (!classDoc.exists) {
    throw new HttpsError("not-found", "Class not found.");
  }

  // Delete all messages in subcollection
  const messages = await classRef.collection("messages").get();
  const batch = db.batch();
  messages.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  // Delete class admin user if stored
  const adminUid = classDoc.data().adminUid;
  if (adminUid) {
    try {
      await getAuth().deleteUser(adminUid);
    } catch (err) {
      // User might already be deleted
    }
  }

  // Delete class document
  await classRef.delete();

  return {status: "deleted"};
});

// ===========================================
// TOGGLE SCHOOL/CLASS ACTIVE (superadmin)
// ===========================================
exports.toggleActive = onCall(async (request) => {
  requireRole(request, "superadmin");

  const {schoolId, classId} = request.data;

  if (!schoolId) {
    throw new HttpsError("invalid-argument", "Missing schoolId.");
  }

  if (classId) {
    const classRef = db.collection("schools").doc(schoolId).collection("classes").doc(classId);
    const doc = await classRef.get();
    if (!doc.exists) throw new HttpsError("not-found", "Class not found.");
    await classRef.update({active: !doc.data().active});
    return {active: !doc.data().active};
  } else {
    const schoolRef = db.collection("schools").doc(schoolId);
    const doc = await schoolRef.get();
    if (!doc.exists) throw new HttpsError("not-found", "School not found.");
    await schoolRef.update({active: !doc.data().active});
    return {active: !doc.data().active};
  }
});
