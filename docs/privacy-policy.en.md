
# Privacy and Data Handling (SAFS)

Last updated: 2026-02-25

1. **Data Controller**
The data controller for SAFS is Joel Seger.
Contact: <joelseger87@gmail.com>

2. **What personal data is processed**
    SAFS processes:
    - Administrator email addresses.
    - Limited anti-abuse metadata for rate limiting (a hashed, truncated representation of request IP + class identifier + timestamp).
    Plain IP addresses are not intentionally stored in clear text in SAFS data records.

3. **Why email addresses are stored**
    Email addresses are required for the service to function: create and manage administrator accounts, enable authentication, and assign and enforce admin permissions.

4. **Why IP-related metadata is used**
    IP-related metadata is used to protect both users and the service against abuse, such as spam, brute-force attempts, and other automated malicious traffic.
    This also reduces the risk of cost-driving abuse and helps keep the service safer and more stable for legitimate users.
    SAFS does not intentionally store plain IP addresses in data records; instead, it stores a hashed/truncated representation for rate limiting.
    This information is not used for profiling and is not intended to identify students.

5. **Other data in the service**
    SAFS also stores schools, classes, and feedback content for the system to function.
    This data is generally not personal data by itself, but it may become personal data if someone enters identifying information in free text.

6. **Security**
   - Feedback is stored encrypted in the database.
   - Authentication for admin and student representative accounts is handled by Firebase Authentication**.
   - Class feedback passwords are stored hashed and salted, and cannot be restored to plain text.
   - Data access is restricted through role-based access control.

7. **Third-party services**
    SAFS uses Google Firebase and Google Cloud for authentication, data storage, and server-side functions.
    Google processes data under its terms as a technical provider/processor.

8. **Retention**
    - Data for school administrators and feedback is stored as long as the account exists.
    - Data for classes and student representatives is stored as long as the class exists.
    - Anti-abuse rate-limit metadata is stored in pseudonymized form and configured for TTL cleanup after 24 hours (actual deletion timing depends on Firestore TTL processing).
    - When an account/class is deleted, so too does all the data linked to that account.

9. **Rights**
    Under applicable law, you have the right to request access to your personal data, and to request correction or deletion.
    Since SAFS does not intentionally* store personal data beyond email addresses, the amount of data that can be disclosed is limited.
    However, an email address can be deleted on request, together with all data linked to that account.

10. **Updates**
    This text may be updated if the service or legal requirements change.
    The latest version is published in SAFS.

\* *Because users can technically enter personal data in messages or class names, such personal data may be stored.
This is not the intended use of these fields, and it is not the intention to process such data as personal data.
Users are responsible for not entering personal data in these fields.*

** *Firebase Authentication stores passwords as salted cryptographic hashes (not plain text) and verifies sign-ins through hash comparison. SAFS never receives access to plain-text passwords.*
