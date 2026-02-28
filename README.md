# Secure Anonymous Feedback System (SAFS)

SAFS is a security-first service for anonymous student feedback in schools.  

## Background and Motivation

The idea for SAFS came from a desire to provide a safe and anonymous channel for students to share feedback with their schools, without fear of retaliation or exposure. Traditional feedback tools often require accounts, have a limited time window for submission, or store identifiable information, which can discourage honest feedback.
Even when the feedback goes through another student, there can be concerns about trust and confidentiality.

### The SAFS Solution

As a student-representative myself, [I created a solution for my own class for this](https://github.com/Holyfivr/Anonform). An anonymous feedback form with a shared password, where only I, and my fellow student representative, could read the messages.
The core goal is simple: let students submit feedback safely and anonymously, while ensuring only the assigned student representative can read messages.

Since I am studying to become a software developer, I have the ability to build something like that. However, other student-representatives might not have the technical skills to set up a secure and anonymous feedback system on their own, and there are no good off-the-shelf solutions that meet these requirements. So I decided to build SAFS as a free service that other classes can use as well.

### What SAFS Is

SAFS is a role-based web platform where a school will have one account. This account can create classes, which are managed by class-level admins (student representatives). Each class has a shared password for submitting anonymous feedback. Only the class admins can read the feedback messages, and they cannot be accessed by school-level or super admins.
The roles and permissions are as follows:

| Role | Permissions |
|------|-------------|
| `superadmin` | Create/deactivate/delete schools, list schools/classes |
| `schooladmin` | Create/deactivate/delete classes in own school |
| `classadmin` | Read/decrypt own class messages, delete messages, reset class feedback password |
| `anonymous` | Submit feedback with valid class password |

The system is designed so school-level admins can manage structure, but cannot read class feedback content.

### Current Development Stage

Current status:

- Core platform is implemented and usable.
- Security architecture is implemented with encryption, hashing, RBAC, and rate limiting.
- Privacy policy is in place (English or Swedish).

Planned/next:

- Add proper landing page. It is currently blank, since it hasn't been a priority. Safety first.
- Create a proper design for the frontend. The current UI is very basic and unstyled, but fully functional.
- Final logistics/onboarding with schools.
- Support form for assistance with the service.
- reCAPTCHA or similar anti-abuse measures if needed (currently relying on rate limits and password protection).

### Security and Anonymity Model

Security and anonymity are first-class concerns in SAFS:

- `Anonymous posting` via public feedback flow (no student account required).
- `Role-based access control` via Firebase Auth custom claims (`superadmin`, `schooladmin`, `classadmin`).
- `Firestore security rules` enforce data boundaries at database level.
- `Message confidentiality` with AES-256-GCM encryption in Cloud Functions using Secret Manager (`ENCRYPTION_KEY`).
- `Password protection` for class feedback password with salted SHA-256 hashes.
- `Rate limiting` in `postMessage` (1 message/min per class + hashed IP key).
- `XSS hardening` through escaped output and safe DOM text insertion patterns.
- `Content Security Policy` in `index.html` to restrict script/style/connect sources.

Important boundary:

- Class messages are not readable by `superadmin` or `schooladmin` through Firestore rules.
- Class message create flow is function-only (not direct client write).

### Tech Stack

- Frontend: HTML5, CSS3, Vanilla JavaScript ES Modules
- Routing: hash-based SPA router (`#/...`)
- Backend: Firebase Cloud Functions v2 (Node.js)
- Auth: Firebase Authentication (Email/Password + custom claims)
- Database: Cloud Firestore + Firestore Security Rules
- Secrets: Firebase Functions Secret Manager (`ENCRYPTION_KEY`)

### Privacy and Compliance

- Privacy policy is available in-app (`#/privacy`) and in `docs/`.
- English source: [docs/privacy-policy.en.md](docs/privacy-policy.en.md).
- Swedish source: [docs/privacy-policy.sv.md](docs/privacy-policy.sv.md).
- SAFS stores minimal personal data (administrator emails) and limited anti-abuse metadata for rate limiting (hashed IP-based key + timestamp, TTL cleanup target: 24 hours).

### Notes

- Firebase web config values in the client are public app identifiers, not secrets.
- Authorization and data protection rely on Auth claims, Firestore rules, and Cloud Functions checks.

### Legal and Ethical Considerations

- SAFS aims to align with GDPR principles and similar data protection laws by minimizing personal data and providing user rights.
- Users should be aware of the limitations of anonymity and avoid sharing personally identifiable information in feedback messages or class names, as this data may be stored and is not the intended use of those fields.
  
### License

[Proprietary – All Rights Reserved.](LICENSE.MD)
No use, copying, modification, or distribution is permitted without explicit written permission.
