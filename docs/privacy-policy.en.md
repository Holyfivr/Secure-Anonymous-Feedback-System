
# Privacy and Data Handling (SAFS)

Last updated: 2026-03-22

1. **Data Controller**
    The data controller for SAFS is Joel Seger.
    Contact: <joelseger87@gmail.com>

2. **What personal data is processed**
    SAFS processes:
    - Administrator email addresses.
    - Limited anti-abuse metadata for rate limiting (a hashed, truncated representation of request IP + request-context identifier + timestamp).
    Plain IP addresses are not intentionally stored in clear text in SAFS data records.

3. **Why email addresses are stored**
    Email addresses are required for the service to function: create and manage administrator accounts, enable authentication, and assign and enforce admin permissions.

4. **Why IP-related metadata is used**
    IP-related metadata is used to protect both users and the service against abuse, such as spam, brute-force attempts, and other automated malicious traffic.
    This also reduces the risk of cost-driving abuse and helps keep the service safer and more stable for legitimate users.
    SAFS does not intentionally store plain IP addresses in data records; instead, it stores a hashed/truncated representation for rate limiting.
    This information is not used for profiling and is not intended to identify students.

5. **Legal basis for processing**
    The processing of email addresses is based on legitimate interest (Art. 6.1f GDPR). The legitimate interest is to provide the service by creating and managing administrator accounts. Without an email address, the service cannot function.
    The processing of anti-abuse metadata (hashed IP data) is based on legitimate interest (Art. 6.1f GDPR). The legitimate interest is to protect the service and its users against abuse, spam, and attacks.

6. **Other data in the service**
    SAFS also stores names of schools, classes, and feedback content for the system to function.
    This data is generally not personal data by itself, but it may become personal data if someone enters identifying information in free text.

7. **Security**
   - Feedback is stored encrypted in the database.
   - Authentication for admin and student representative accounts is handled by Firebase Authentication**.
   - Class feedback passwords are stored hashed and salted, and cannot be restored to plain text.
   - Data access is restricted through role-based access control.

8. **Third-party services**
    SAFS uses Google Firebase and Google Cloud for authentication, data storage, and server-side functions.
    Google processes data under its terms as a technical provider/processor.

9. **Third-country transfers**
    SAFS uses Google Firebase and Google Cloud, which may process data outside the EU/EEA. Google applies the European Commission's Standard Contractual Clauses (SCCs) and other appropriate safeguards to ensure that transferred data is protected in accordance with GDPR.
    More information can be found in Google's data processing terms.

10. **Retention**
    - Data for school administrators and feedback is stored as long as the account exists.
    - Data for classes and student representatives is stored as long as the class exists.
    - Anti-abuse rate-limit metadata is stored in pseudonymized form and configured for TTL cleanup after 24 hours (actual deletion timing depends on Firestore TTL processing).
    - When an account/class is deleted, so too does all the data linked to that account.

11. **Rights**
    Under the GDPR, you have the right to:
    - Request access to your personal data (Art. 15).
    - Request correction of inaccurate data (Art. 16).
    - Request deletion of your data (Art. 17).
    - Request restriction of processing (Art. 18).
    - Object to processing (Art. 21).
    - Request data portability (Art. 20).

    Since SAFS does not intentionally* store personal data beyond email addresses, the amount of data that can be disclosed is limited.
    However, an email address can be deleted on request, together with all data linked to that account.

    You also have the right to lodge a complaint with the Swedish Authority for Privacy Protection (IMY), which is the supervisory authority in Sweden. More information is available at imy.se.

12. **Automated decision-making**
    SAFS does not use automated decision-making or profiling within the meaning of Art. 22 GDPR.

13. **Updates**
    This text may be updated if the service or legal requirements change.
    The latest version is published in SAFS.

\* *Because users can technically enter personal data in messages or class names, such personal data may be stored.
This is not the intended use of these fields, and it is not the intention to process such data as personal data.
Users are responsible for not entering personal data in these fields.*

** *Firebase Authentication stores passwords as salted cryptographic hashes (not plain text) and verifies sign-ins through hash comparison. SAFS never receives access to plain-text passwords.*
