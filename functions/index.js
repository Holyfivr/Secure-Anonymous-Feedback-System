/* eslint-disable linebreak-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();
const crypto = require("crypto");

// Encryption key for message confidentiality (set via: firebase functions:secrets:set ENCRYPTION_KEY)
const encryptionKey = defineSecret("ENCRYPTION_KEY");

// --- Helper: salted SHA-256 ---
function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(salt + password).digest("hex");
}

function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

// --- Helper: AES-256-GCM encryption ---
function encryptText(plaintext, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  // Format: iv:authTag:ciphertext (all hex)
  return iv.toString("hex") + ":" + authTag + ":" + encrypted;
}

function decryptText(ciphertext, keyHex) {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");
  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// --- Helper: check caller role ---
function requireRole(context, role) {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }
  if (context.auth.token.role !== role) {
    throw new HttpsError("permission-denied", `Requires ${role} role.`);
  }
}

// --- Helper: create Firebase Auth user with mapped errors ---
async function createUserOrThrow(email, password) {
  try {
    return await getAuth().createUser({email, password});
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
}

// --- Helper: delete all documents in a collection (batched) ---
async function deleteAllDocuments(collectionRef) {
  let snapshot = await collectionRef.limit(500).get();
  while (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    snapshot = await collectionRef.limit(500).get();
  }
}

/* ========================================== */=
// LIST ACTIVE SCHOOLS (public, for picker)
/* ========================================== */=
exports.listSchools = onCall({region: "europe-west1"}, async () => {
  const snapshot = await db.collection("schools").where("active", "==", true).get();
  return snapshot.docs.map((doc) => ({id: doc.id, name: doc.data().name}));
});

/* ========================================== */=
// LIST ACTIVE CLASSES (public, for picker)
/* ========================================== */=
exports.listClasses = onCall({region: "europe-west1"}, async (request) => {
  const {schoolId} = request.data;
  if (!schoolId) {
    throw new HttpsError("invalid-argument", "Missing schoolId.");
  }

  await assertSchoolActive(schoolId);

  const snapshot = await db.collection("schools").doc(schoolId)
      .collection("classes").where("active", "==", true).get();
  return snapshot.docs.map((doc) => ({id: doc.id, name: doc.data().name}));
});

/* ========================================== */=
// GET CLASS NAME (public, for feedback form)
/* ========================================== */=
exports.getClassName = onCall({region: "europe-west1"}, async (request) => {
  const {schoolId, classId} = request.data;
  if (!schoolId || !classId) {
    throw new HttpsError("invalid-argument", "Missing schoolId or classId.");
  }

  await assertSchoolActive(schoolId);

  const classDoc = await db.collection("schools").doc(schoolId)
      .collection("classes").doc(classId).get();
  if (!classDoc.exists || !classDoc.data().active) {
    throw new HttpsError("not-found", "Class not found or inactive.");
  }
  return {name: classDoc.data().name};
});

/* ========================================== */=
// CREATE SCHOOL (superadmin only)
/* ========================================== */=
exports.createSchool = onCall({region: "europe-west1"}, async (request) => {
  requireRole(request, "superadmin");

  const {schoolName, adminEmail, adminPassword} = request.data;

  if (!schoolName || !adminEmail || !adminPassword) {
    throw new HttpsError("invalid-argument", "Missing fields.");
  }
  if (adminPassword.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be 6+ characters.");
  }

  const userRecord = await createUserOrThrow(adminEmail, adminPassword);

  // Create school document (with adminUid so we can delete the account later)
  const schoolRef = db.collection("schools").doc();
  await schoolRef.set({
    name: schoolName,
    active: true,
    adminUid: userRecord.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Set custom claims with schoolId
  await getAuth().setCustomUserClaims(userRecord.uid, {
    role: "schooladmin",
    schoolId: schoolRef.id,
  });

  return {schoolId: schoolRef.id, adminUid: userRecord.uid};
});

/* ========================================== */=
// CREATE CLASS (school admin only)
/* ========================================== */=
exports.createClass = onCall({region: "europe-west1"}, async (request) => {
  requireRole(request, "schooladmin");

  const schoolId = request.auth.token.schoolId;
  const {className, adminEmail, adminPassword, feedbackPassword} = request.data;

  if (!className || !adminEmail || !adminPassword || !feedbackPassword) {
    throw new HttpsError("invalid-argument", "Missing fields.");
  }
  if (feedbackPassword.length < 6) {
    throw new HttpsError("invalid-argument", "Post password must be 6+ characters.");
  }

  // Hash the post password (salted SHA-256)
  const salt = generateSalt();
  const feedbackPasswordHash = hashPassword(feedbackPassword, salt);

  const userRecord = await createUserOrThrow(adminEmail, adminPassword);

  // Create class document
  const classRef = db.collection("schools").doc(schoolId).collection("classes").doc();
  await classRef.set({
    name: className,
    active: true,
    feedbackPasswordHash,
    feedbackPasswordSalt: salt,
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

/* ========================================== */=
// RESET CLASS POST PASSWORD (class admin only)
/* ========================================== */=
exports.resetFeedbackPassword = onCall({region: "europe-west1"}, async (request) => {
  requireRole(request, "classadmin");
  const schoolId = request.auth.token.schoolId;
  const classId = request.auth.token.classId;
  const {newFeedbackPassword} = request.data;

  const normalizedPassword = newFeedbackPassword?.trim();

  if (!normalizedPassword || normalizedPassword.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be 6+ characters.");
  }

  const salt = generateSalt();
  const feedbackPasswordHash = hashPassword(normalizedPassword, salt);
  const classRef = db.collection("schools").doc(schoolId).collection("classes").doc(classId);
  await classRef.update({feedbackPasswordHash, feedbackPasswordSalt: salt});

  return {status: "ok"};
});

/* ========================================== */=
// POST MESSAGE (anonymous, rate-limited)
/* ========================================== */=
exports.postMessage = onCall({secrets: [encryptionKey], region: "europe-west1"}, async (request) => {
  const {schoolId, classId, text, password} = request.data;

  if (!schoolId || !classId || !text || !password) {
    throw new HttpsError("invalid-argument", "Missing fields.");
  }

  await assertSchoolActive(schoolId);

  if (text.length > 500) {
    throw new HttpsError("invalid-argument", "Message too long (max 500 chars).");
  }

  // Get class document
  const classRef = db.collection("schools").doc(schoolId).collection("classes").doc(classId);
  const classDoc = await classRef.get();

  if (!classDoc.exists || !classDoc.data().active) {
    throw new HttpsError("not-found", "Class not found or inactive.");
  }

  // Verify post password (salted SHA-256, backwards compatible with unsalted)
  const classData = classDoc.data();
  const salt = classData.feedbackPasswordSalt || "";
  const hash = hashPassword(password, salt);
  if (hash !== classData.feedbackPasswordHash) {
    throw new HttpsError("permission-denied", "Wrong password.");
  }

  // Rate limit: per IP per class (60s cooldown)
  const ip = request.rawRequest?.ip || "unknown";
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
  const rateLimitRef = db.collection("rateLimits").doc(`${classId}_${ipHash}`);
  const rateLimitDoc = await rateLimitRef.get();

  if (rateLimitDoc.exists) {
    const lastTime = rateLimitDoc.data().lastPostAt?.toMillis() || 0;
    if (Date.now() - lastTime < 60000) {
      throw new HttpsError("resource-exhausted", "Wait 1 minute between messages.");
    }
  }

  // Encrypt and write message
  const encryptedText = encryptText(text, encryptionKey.value());
  const messagesRef = classRef.collection("messages");
  await messagesRef.add({
    text: encryptedText,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Update rate limit timestamp
  await rateLimitRef.set({lastPostAt: FieldValue.serverTimestamp()});

  return {status: "ok"};
});

/* ========================================== */=
// LIST MESSAGES (classadmin only, decrypts)
/* ========================================== */=
exports.listMessages = onCall({secrets: [encryptionKey], region: "europe-west1"}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }
  if (request.auth.token.role !== "classadmin") {
    throw new HttpsError("permission-denied", "Requires classadmin role.");
  }

  const schoolId = request.auth.token.schoolId;
  const classId = request.auth.token.classId;

  const messagesRef = db.collection("schools").doc(schoolId)
      .collection("classes").doc(classId).collection("messages");
  const snapshot = await messagesRef.orderBy("createdAt", "desc").get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();

    // Decrypt message (fallback to raw text for old unencrypted messages)
    let text;
    try {
      text = decryptText(data.text, encryptionKey.value());
    } catch {
      text = data.text;
    }

    const createdAt = data.createdAt?.toDate()?.toISOString() || null;
    return {id: doc.id, text, createdAt};
  });
});

/* ========================================== */=
// DELETE CLASS (school admin only)
/* ========================================== */=
exports.deleteClass = onCall({region: "europe-west1"}, async (request) => {
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

  if (classDoc.data().active) {
    throw new HttpsError("failed-precondition", "Deactivate the class before deleting.");
  }

  // Delete all messages in subcollection
  await deleteAllDocuments(classRef.collection("messages"));

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

/* ========================================== */=
// DELETE SCHOOL (superadmin only)
/* ========================================== */=
exports.deleteSchool = onCall({region: "europe-west1"}, async (request) => {
  requireRole(request, "superadmin");

  const {schoolId} = request.data;
  if (!schoolId) {
    throw new HttpsError("invalid-argument", "Missing schoolId.");
  }

  const schoolRef = db.collection("schools").doc(schoolId);
  const schoolDoc = await schoolRef.get();
  if (!schoolDoc.exists) {
    throw new HttpsError("not-found", "School not found.");
  }

  if (schoolDoc.data().active) {
    throw new HttpsError("failed-precondition", "Deactivate the school before deleting.");
  }

  // Delete all classes and their messages/users
  const classesSnapshot = await schoolRef.collection("classes").get();
  for (const classDoc of classesSnapshot.docs) {
    await deleteAllDocuments(classDoc.ref.collection("messages"));

    const classAdminUid = classDoc.data().adminUid;
    if (classAdminUid) {
      try {
        await getAuth().deleteUser(classAdminUid);
      } catch (err) {
        // User may already be deleted
      }
    }

    await classDoc.ref.delete();
  }

  // Delete school admin user
  const schoolAdminUid = schoolDoc.data().adminUid;
  if (schoolAdminUid) {
    try {
      await getAuth().deleteUser(schoolAdminUid);
    } catch (err) {
      // User may already be deleted
    }
  }

  // Delete school document
  await schoolRef.delete();

  return {status: "deleted"};
});

/* ========================================== */=
// LIST CLASS NAMES (superadmin, for overview)
/* ========================================== */=
exports.listClassNames = onCall({region: "europe-west1"}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  const role = request.auth.token.role;
  const {schoolId} = request.data;

  if (!schoolId) {
    throw new HttpsError("invalid-argument", "Missing schoolId.");
  }

  // Schooladmin can only list classes in their own school
  if (role === "schooladmin") {
    if (request.auth.token.schoolId !== schoolId) {
      throw new HttpsError("permission-denied", "Not your school.");
    }
  } else if (role !== "superadmin") {
    throw new HttpsError("permission-denied", "Requires superadmin or schooladmin role.");
  }

  const snapshot = await db.collection("schools").doc(schoolId)
      .collection("classes").get();
  return snapshot.docs.map((doc) => ({id: doc.id, name: doc.data().name, active: doc.data().active}));
});

/* ========================================== */=
// TOGGLE SCHOOL/CLASS ACTIVE
// - Superadmin: can toggle any school or class
// - School admin: can toggle own classes only
/* ========================================== */=
exports.toggleActive = onCall({region: "europe-west1"}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  const role = request.auth.token.role;
  const {schoolId, classId} = request.data;

  if (!schoolId) {
    throw new HttpsError("invalid-argument", "Missing schoolId.");
  }

  // School admin can only toggle classes in their own school
  if (role === "schooladmin") {
    if (!classId) {
      throw new HttpsError("permission-denied", "School admins cannot toggle schools.");
    }
    if (request.auth.token.schoolId !== schoolId) {
      throw new HttpsError("permission-denied", "Not your school.");
    }
    const classRef = db.collection("schools").doc(schoolId).collection("classes").doc(classId);
    const doc = await classRef.get();
    if (!doc.exists) throw new HttpsError("not-found", "Class not found.");
    await classRef.update({active: !doc.data().active});
    return {active: !doc.data().active};
  }

  // Superadmin can toggle anything
  if (role === "superadmin") {
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
  }

  throw new HttpsError("permission-denied", "Insufficient permissions.");
});

/* Helper function to prevent classes in an inactive school from being accessed through direct links. */
async function assertSchoolActive(schoolId) {
  const schoolDoc = await db.collection("schools").doc(schoolId).get();
  if (!schoolDoc.exists || !schoolDoc.data().active) {
    throw new HttpsError("not-found", "School not found or inactive.");
  }
}
