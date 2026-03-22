/* eslint-disable linebreak-style */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore, FieldValue, Timestamp} = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();
const crypto = require("crypto");

// Encryption key for message confidentiality (set via: firebase functions:secrets:set ENCRYPTION_KEY)
const encryptionKey = defineSecret("ENCRYPTION_KEY");

const FEEDBACK_PASSWORD_SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keyLen: 32,
  maxmem: 64 * 1024 * 1024,
};
// TTL marker for anti-abuse documents in Firestore (cleanup target: 24 hours).
const RATE_LIMIT_TTL_MS = 24 * 60 * 60 * 1000;
// Sliding window length for feedback password attempt counting.
const ATTEMPT_WINDOW_MS = 60 * 1000;
// Maximum feedback post attempts allowed per window before temporary blocking.
const MAX_ATTEMPTS_PER_WINDOW = 20;
// Block duration after attempt threshold is exceeded.
const ATTEMPT_BLOCK_MS = 20 * 60 * 1000;
// Sliding window length for public picker endpoints (listSchools/listClasses/getClassName).
const PUBLIC_PICKER_WINDOW_MS = 60 * 1000;
// Maximum public picker requests allowed per window before temporary blocking.
const PUBLIC_PICKER_MAX_PER_WINDOW = 30;
// Block duration for public picker abuse.
const PUBLIC_PICKER_BLOCK_MS = 10 * 60 * 1000;
// Default number of messages returned by listMessages when no explicit limit is provided.
const LIST_MESSAGES_DEFAULT_LIMIT = 100;
// Hard upper cap for listMessages limit to avoid large expensive reads.
const LIST_MESSAGES_MAX_LIMIT = 200;
// Defensive caps for public listing endpoints.
const LIST_SCHOOLS_PUBLIC_LIMIT = 100;
const LIST_CLASSES_PUBLIC_LIMIT = 100;

// Fast in-memory gate to reject obvious bursts before Firestore I/O.
const QUICK_GATE_WINDOW_MS = 10 * 1000;
const QUICK_GATE_POST_LIMIT = 10;
const QUICK_GATE_PICKER_LIMIT = 20;
const INSTANCE_RATE_GC_INTERVAL_MS = 60 * 1000;

// Cloud Functions scaling caps for controlled beta rollout.
const MAX_INSTANCES_PUBLIC_PICKER = 2;
const MAX_INSTANCES_PUBLIC_POST = 3;
const MAX_INSTANCES_ADMIN = 2;
const MAX_INSTANCES_CLASSADMIN_READ = 2;
// Use gen1-like CPU allocation to reduce Cloud Run CPU quota pressure in beta.
const BETA_CPU_PROFILE = "gcf_gen1";
const instanceRateMap = new Map();
let lastInstanceRateCleanupMs = 0;

function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function timingSafeHexEqual(aHex, bHex) {
  if (!aHex || !bHex || aHex.length !== bHex.length) return false;

  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function scryptHash(password, saltHex, params = FEEDBACK_PASSWORD_SCRYPT_PARAMS) {
  const salt = Buffer.from(saltHex, "hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(
        password,
        salt,
        params.keyLen,
        {N: params.N, r: params.r, p: params.p, maxmem: params.maxmem},
        (err, derivedKey) => {
          if (err) return reject(err);
          resolve(derivedKey.toString("hex"));
        },
    );
  });
}

async function createFeedbackPasswordRecord(password) {
  const salt = generateSalt();
  const hash = await scryptHash(password, salt);

  return {
    feedbackPasswordHash: hash,
    feedbackPasswordSalt: salt,
    feedbackPasswordAlgo: "scrypt",
    feedbackPasswordParams: {
      N: FEEDBACK_PASSWORD_SCRYPT_PARAMS.N,
      r: FEEDBACK_PASSWORD_SCRYPT_PARAMS.r,
      p: FEEDBACK_PASSWORD_SCRYPT_PARAMS.p,
      keyLen: FEEDBACK_PASSWORD_SCRYPT_PARAMS.keyLen,
    },
  };
}

async function verifyFeedbackPassword(classData, password) {
  if (!classData?.feedbackPasswordHash) {
    return {ok: false};
  }

  // Current format: scrypt with per-class salt and stored params
  if (classData.feedbackPasswordAlgo === "scrypt") {
    const params = classData.feedbackPasswordParams || {
      N: FEEDBACK_PASSWORD_SCRYPT_PARAMS.N,
      r: FEEDBACK_PASSWORD_SCRYPT_PARAMS.r,
      p: FEEDBACK_PASSWORD_SCRYPT_PARAMS.p,
      keyLen: FEEDBACK_PASSWORD_SCRYPT_PARAMS.keyLen,
    };

    const salt = classData.feedbackPasswordSalt;
    if (!salt) return {ok: false};

    const computed = await scryptHash(password, salt, {
      N: params.N,
      r: params.r,
      p: params.p,
      keyLen: params.keyLen,
      maxmem: FEEDBACK_PASSWORD_SCRYPT_PARAMS.maxmem,
    });

    return {ok: timingSafeHexEqual(computed, classData.feedbackPasswordHash)};
  }

  return {ok: false};
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
  if (!ciphertext || typeof ciphertext !== "string") {
    throw new Error("Invalid ciphertext format");
  }

  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
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
    throw new HttpsError("internal", "Could not create user. Please try again later.");
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

async function enforcePostAttemptRateLimit(rateLimitRef) {
  const now = Date.now();
  const nowTs = Timestamp.fromMillis(now);
  const expiresAt = Timestamp.fromMillis(now + RATE_LIMIT_TTL_MS);

  const state = await db.runTransaction(async (tx) => {
    const snap = await tx.get(rateLimitRef);
    const data = snap.exists ? snap.data() : {};

    const blockedUntilMs = data.blockedUntil?.toMillis?.() || 0;
    if (blockedUntilMs > now) {
      return {
        blocked: true,
        blockedUntilMs,
      };
    }

    const windowStartMs = data.windowStartAt?.toMillis?.() || now;
    const windowExpired = now - windowStartMs >= ATTEMPT_WINDOW_MS;
    const attempts = windowExpired ? 1 : (data.attemptCount || 0) + 1;
    const nextWindowStartMs = windowExpired ? now : windowStartMs;
    const nextBlockedUntilMs = attempts > MAX_ATTEMPTS_PER_WINDOW ?
      now + ATTEMPT_BLOCK_MS :
      0;

    tx.set(rateLimitRef, {
      attemptCount: attempts,
      windowStartAt: Timestamp.fromMillis(nextWindowStartMs),
      blockedUntil: nextBlockedUntilMs ? Timestamp.fromMillis(nextBlockedUntilMs) : null,
      lastAttemptAt: nowTs,
      expiresAt,
    }, {merge: true});

    return {
      blocked: nextBlockedUntilMs > now,
      blockedUntilMs: nextBlockedUntilMs,
    };
  });

  if (state.blocked) {
    throw new HttpsError(
        "resource-exhausted",
        "Too many attempts. Try again in 20 minutes.",
    );
  }
}

function maybeCleanupInstanceRateMap(nowMs, windowMs) {
  if (nowMs - lastInstanceRateCleanupMs < INSTANCE_RATE_GC_INTERVAL_MS) {
    return;
  }

  for (const [key, entry] of instanceRateMap.entries()) {
    if (nowMs - entry.start > windowMs * 2) {
      instanceRateMap.delete(key);
    }
  }

  lastInstanceRateCleanupMs = nowMs;
}

function quickInstanceLimit(key, limit, windowMs) {
  const now = Date.now();
  maybeCleanupInstanceRateMap(now, windowMs);

  const entry = instanceRateMap.get(key);
  if (!entry) {
    instanceRateMap.set(key, {count: 1, start: now});
    return true;
  }

  if (now - entry.start > windowMs) {
    entry.count = 1;
    entry.start = now;
    return true;
  }

  entry.count += 1;
  return entry.count <= limit;
}

function extractClientIp(rawRequest) {
  const forwardedForHeader = rawRequest?.headers?.["x-forwarded-for"];
  const forwardedForValue = Array.isArray(forwardedForHeader) ?
    forwardedForHeader[0] :
    forwardedForHeader;

  const forwardedIp = typeof forwardedForValue === "string" ?
    forwardedForValue.split(",")[0].trim() :
    "";

  return forwardedIp || rawRequest?.ip || rawRequest?.socket?.remoteAddress || "unknown";
}

function buildPublicPickerRateLimitKey(request, endpointName) {
  const ip = extractClientIp(request.rawRequest);

  // Keep key stable across repeated requests from the same client IP.
  // App Check tokens may rotate and would otherwise bypass rate counting.
  return crypto.createHash("sha256")
      .update(`${endpointName}|${ip}`)
      .digest("hex")
      .slice(0, 24);
}

function buildQuickGateKey(request, scope) {
  const ip = extractClientIp(request.rawRequest);
  const userAgent = String(request.rawRequest?.headers?.["user-agent"] || "unknown");

  return crypto.createHash("sha256")
      .update(`${scope}|${ip}|${userAgent}`)
      .digest("hex")
      .slice(0, 24);
}

async function enforcePublicPickerRateLimit(request, endpointName) {
  const rateLimitKey = buildPublicPickerRateLimitKey(request, endpointName);
  const docRef = db.collection("rateLimits").doc(`public_${endpointName}_${rateLimitKey}`);
  const now = Date.now();
  const nowTs = Timestamp.fromMillis(now);
  const expiresAt = Timestamp.fromMillis(now + RATE_LIMIT_TTL_MS);

  const state = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.exists ? snap.data() : {};

    const blockedUntilMs = data.blockedUntil?.toMillis?.() || 0;
    if (blockedUntilMs > now) {
      return {blocked: true};
    }

    const windowStartMs = data.windowStartAt?.toMillis?.() || now;
    const windowExpired = now - windowStartMs >= PUBLIC_PICKER_WINDOW_MS;
    const attempts = windowExpired ? 1 : (data.requestCount || 0) + 1;
    const nextWindowStartMs = windowExpired ? now : windowStartMs;
    const nextBlockedUntilMs = attempts > PUBLIC_PICKER_MAX_PER_WINDOW ?
      now + PUBLIC_PICKER_BLOCK_MS :
      0;

    tx.set(docRef, {
      endpoint: endpointName,
      requestCount: attempts,
      windowStartAt: Timestamp.fromMillis(nextWindowStartMs),
      blockedUntil: nextBlockedUntilMs ? Timestamp.fromMillis(nextBlockedUntilMs) : null,
      lastRequestAt: nowTs,
      expiresAt,
    }, {merge: true});

    return {blocked: nextBlockedUntilMs > now};
  });

  if (state.blocked) {
    throw new HttpsError(
        "resource-exhausted",
        "Too many requests. Try again later.",
    );
  }
}

/* ========================================== */
// LIST ACTIVE SCHOOLS (public, for picker)
/* ========================================== */
exports.listSchools = onCall({region: "europe-west1", enforceAppCheck: true, cpu: BETA_CPU_PROFILE, maxInstances: MAX_INSTANCES_PUBLIC_PICKER}, async (request) => {
  const quickGateKey = buildQuickGateKey(request, "listSchools");
  if (!quickInstanceLimit(quickGateKey, QUICK_GATE_PICKER_LIMIT, QUICK_GATE_WINDOW_MS)) {
    throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
  }

  await enforcePublicPickerRateLimit(request, "listSchools");
  const snapshot = await db.collection("schools")
      .where("active", "==", true)
      .limit(LIST_SCHOOLS_PUBLIC_LIMIT)
      .get();
  return snapshot.docs.map((doc) => ({id: doc.id, name: doc.data().name}));
});

/* ========================================== */
// LIST ACTIVE CLASSES (public, for picker)
/* ========================================== */
exports.listClasses = onCall({region: "europe-west1", enforceAppCheck: true, cpu: BETA_CPU_PROFILE, maxInstances: MAX_INSTANCES_PUBLIC_PICKER}, async (request) => {
  const quickGateKey = buildQuickGateKey(request, "listClasses");
  if (!quickInstanceLimit(quickGateKey, QUICK_GATE_PICKER_LIMIT, QUICK_GATE_WINDOW_MS)) {
    throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
  }

  await enforcePublicPickerRateLimit(request, "listClasses");
  const {schoolId} = request.data;
  if (!schoolId) {
    throw new HttpsError("invalid-argument", "Missing schoolId.");
  }

  await assertSchoolActive(schoolId);

  const snapshot = await db.collection("schools").doc(schoolId)
      .collection("classes")
      .where("active", "==", true)
      .limit(LIST_CLASSES_PUBLIC_LIMIT)
      .get();
  return snapshot.docs.map((doc) => ({id: doc.id, name: doc.data().name}));
});

/* ========================================== */
// GET CLASS NAME (public, for feedback form)
/* ========================================== */
exports.getClassName = onCall({region: "europe-west1", enforceAppCheck: true, cpu: BETA_CPU_PROFILE, maxInstances: MAX_INSTANCES_PUBLIC_PICKER}, async (request) => {
  const quickGateKey = buildQuickGateKey(request, "getClassName");
  if (!quickInstanceLimit(quickGateKey, QUICK_GATE_PICKER_LIMIT, QUICK_GATE_WINDOW_MS)) {
    throw new HttpsError("resource-exhausted", "Too many requests. Try again later.");
  }

  await enforcePublicPickerRateLimit(request, "getClassName");
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

/* ========================================== */
// CREATE SCHOOL (superadmin only)
/* ========================================== */
exports.createSchool = onCall({region: "europe-west1", enforceAppCheck: true, cpu: BETA_CPU_PROFILE, maxInstances: MAX_INSTANCES_ADMIN}, async (request) => {
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
  let schoolDocCreated = false;

  try {
    await schoolRef.set({
      name: schoolName,
      active: true,
      adminUid: userRecord.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    schoolDocCreated = true;

    // Set custom claims with schoolId
    await getAuth().setCustomUserClaims(userRecord.uid, {
      role: "schooladmin",
      schoolId: schoolRef.id,
    });
  } catch (err) {
    if (schoolDocCreated) {
      await schoolRef.delete().catch(() => {});
    }
    await getAuth().deleteUser(userRecord.uid).catch(() => {});

    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", "Could not create school. Please try again later.");
  }

  return {schoolId: schoolRef.id, adminUid: userRecord.uid};
});

/* ========================================== */
// CREATE CLASS (school admin only)
/* ========================================== */
exports.createClass = onCall({region: "europe-west1", enforceAppCheck: true, cpu: BETA_CPU_PROFILE, maxInstances: MAX_INSTANCES_ADMIN}, async (request) => {
  requireRole(request, "schooladmin");

  const schoolId = request.auth.token.schoolId;
  const {className, adminEmail, adminPassword, feedbackPassword} = request.data;

  if (!className || !adminEmail || !adminPassword || !feedbackPassword) {
    throw new HttpsError("invalid-argument", "Missing fields.");
  }
  if (feedbackPassword.length < 6) {
    throw new HttpsError("invalid-argument", "Post password must be 6+ characters.");
  }

  // Hash feedback password with scrypt
  const feedbackPasswordRecord = await createFeedbackPasswordRecord(feedbackPassword);

  const userRecord = await createUserOrThrow(adminEmail, adminPassword);

  // Create class document
  const classRef = db.collection("schools").doc(schoolId).collection("classes").doc();
  let classDocCreated = false;

  try {
    await classRef.set({
      name: className,
      active: true,
      ...feedbackPasswordRecord,
      adminUid: userRecord.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    classDocCreated = true;

    // Set custom claims
    await getAuth().setCustomUserClaims(userRecord.uid, {
      role: "classadmin",
      schoolId: schoolId,
      classId: classRef.id,
    });
  } catch (err) {
    if (classDocCreated) {
      await classRef.delete().catch(() => {});
    }
    await getAuth().deleteUser(userRecord.uid).catch(() => {});

    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", "Could not create class. Please try again later.");
  }

  return {classId: classRef.id, adminUid: userRecord.uid};
});

/* ========================================== */
// RESET CLASS POST PASSWORD (class admin only)
/* ========================================== */
exports.resetFeedbackPassword = onCall({region: "europe-west1", enforceAppCheck: true, cpu: BETA_CPU_PROFILE, maxInstances: MAX_INSTANCES_ADMIN}, async (request) => {
  requireRole(request, "classadmin");
  const schoolId = request.auth.token.schoolId;
  const classId = request.auth.token.classId;
  const {newFeedbackPassword} = request.data;

  const normalizedPassword = newFeedbackPassword?.trim();

  if (!normalizedPassword || normalizedPassword.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be 6+ characters.");
  }

  const feedbackPasswordRecord = await createFeedbackPasswordRecord(normalizedPassword);
  const classRef = db.collection("schools").doc(schoolId).collection("classes").doc(classId);
  await classRef.update(feedbackPasswordRecord);

  return {status: "ok"};
});

/* ========================================== */
// POST MESSAGE (anonymous, rate-limited)
/* ========================================== */
exports.postMessage = onCall({secrets: [encryptionKey], region: "europe-west1", enforceAppCheck: true, cpu: BETA_CPU_PROFILE, maxInstances: MAX_INSTANCES_PUBLIC_POST}, async (request) => {
  const {schoolId, classId, text, password} = request.data;

  if (!schoolId || !classId || !text || !password) {
    throw new HttpsError("invalid-argument", "Missing fields.");
  }

  const quickGateKey = buildQuickGateKey(request, `postMessage:${classId}`);
  if (!quickInstanceLimit(quickGateKey, QUICK_GATE_POST_LIMIT, QUICK_GATE_WINDOW_MS)) {
    throw new HttpsError("resource-exhausted", "Too many requests");
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

  // Count all attempts (including wrong passwords) to close brute-force gaps.
  const ip = extractClientIp(request.rawRequest);
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
  const rateLimitRef = db.collection("rateLimits").doc(`${classId}_${ipHash}`);
  await enforcePostAttemptRateLimit(rateLimitRef);

  // Verify post password (scrypt; legacy SHA-256 auto-migrated on success)
  const classData = classDoc.data();
  const verification = await verifyFeedbackPassword(classData, password);
  if (!verification.ok) {
    throw new HttpsError("permission-denied", "Wrong password.");
  }

  // Atomic cooldown check + message write to prevent race conditions.
  const encryptedText = encryptText(text, encryptionKey.value());
  await db.runTransaction(async (tx) => {
    const rateLimitDoc = await tx.get(rateLimitRef);

    if (rateLimitDoc.exists) {
      const lastTime = rateLimitDoc.data().lastPostAt?.toMillis() || 0;
      if (Date.now() - lastTime < 60000) {
        throw new HttpsError("resource-exhausted", "Wait 1 minute between messages.");
      }
    }

    const messagesRef = classRef.collection("messages");
    const newMsgRef = messagesRef.doc();
    tx.create(newMsgRef, {
      text: encryptedText,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Merge to preserve existing rate limit fields (attemptCount, blockedUntil, etc.)
    tx.set(rateLimitRef, {
      lastPostAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + RATE_LIMIT_TTL_MS),
    }, {merge: true});
  });

  return {status: "ok"};
});

/* ========================================== */
// LIST MESSAGES (classadmin only, decrypts)
/* ========================================== */
exports.listMessages = onCall({secrets: [encryptionKey], region: "europe-west1", enforceAppCheck: true, cpu: BETA_CPU_PROFILE, maxInstances: MAX_INSTANCES_CLASSADMIN_READ}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }
  if (request.auth.token.role !== "classadmin") {
    throw new HttpsError("permission-denied", "Requires classadmin role.");
  }

  const schoolId = request.auth.token.schoolId;
  const classId = request.auth.token.classId;
  const limitRaw = Number(request.data?.limit);
  const pageSize = Number.isInteger(limitRaw) ?
    Math.min(Math.max(limitRaw, 1), LIST_MESSAGES_MAX_LIMIT) :
    LIST_MESSAGES_DEFAULT_LIMIT;
  const pageTokenRaw = request.data?.pageToken;

  const messagesRef = db.collection("schools").doc(schoolId)
      .collection("classes").doc(classId).collection("messages");
  let messagesQuery = messagesRef.orderBy("createdAt", "desc").limit(pageSize);

  if (pageTokenRaw != null) {
    const tokenMillis = Number(pageTokenRaw);
    if (!Number.isFinite(tokenMillis) || tokenMillis <= 0) {
      throw new HttpsError("invalid-argument", "Invalid pageToken.");
    }
    messagesQuery = messagesQuery.startAfter(Timestamp.fromMillis(tokenMillis));
  }

  const snapshot = await messagesQuery.get();

  const messages = snapshot.docs.map((doc) => {
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

  // Backwards compatibility: old clients expect an array payload.
  if (request.data?.limit == null && pageTokenRaw == null) {
    return messages;
  }

  let nextPageToken = null;
  if (snapshot.size === pageSize && snapshot.docs.length > 0) {
    const lastCreatedAt = snapshot.docs[snapshot.docs.length - 1].data().createdAt;
    nextPageToken = lastCreatedAt?.toMillis?.()?.toString() || null;
  }

  return {messages, nextPageToken};
});

/* ========================================== */
// DELETE CLASS (school admin only)
/* ========================================== */
exports.deleteClass = onCall({region: "europe-west1", enforceAppCheck: true, cpu: BETA_CPU_PROFILE, maxInstances: MAX_INSTANCES_ADMIN}, async (request) => {
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

/* ========================================== */
// DELETE SCHOOL (superadmin only)
/* ========================================== */
exports.deleteSchool = onCall({region: "europe-west1", enforceAppCheck: true, cpu: BETA_CPU_PROFILE, maxInstances: MAX_INSTANCES_ADMIN}, async (request) => {
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

/* ========================================== */
// LIST CLASS NAMES (superadmin, for overview)
/* ========================================== */
exports.listClassNames = onCall({region: "europe-west1", enforceAppCheck: true, cpu: BETA_CPU_PROFILE, maxInstances: MAX_INSTANCES_ADMIN}, async (request) => {
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

/* ========================================== */
// TOGGLE SCHOOL/CLASS ACTIVE
// - Superadmin: can toggle any school or class
// - School admin: can toggle own classes only
/* ========================================== */
exports.toggleActive = onCall({region: "europe-west1", enforceAppCheck: true, cpu: BETA_CPU_PROFILE, maxInstances: MAX_INSTANCES_ADMIN}, async (request) => {
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

  // Superadmin can toggle anything (but classes are not activated)
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
