
# Privacy and Data Handling (SAFS)

Last updated: 2026-02-25

1. **Data Controller**
The data controller for SAFS is Joel Seger.
Contact: <joelseger87@gmail.com>

2. **What personal data is processed**
    The only personal data SAFS intentionally* stores is administrator email addresses.

3. **Why email addresses are stored**
    Email addresses are required for the service to function: create and manage administrator accounts, enable authentication, and assign and enforce admin permissions.

4. **Other data in the service**
    SAFS also stores schools, classes, and feedback content for the system to function.
    This data is generally not personal data by itself, but it may become personal data if someone enters identifying information in free text.

5. **Security**
   - Feedback is stored encrypted in the database.
   - Authentication for admin and student representative accounts is handled by Firebase Authentication**.
   - Class feedback passwords are stored hashed and salted, and cannot be restored to plain text.
   - Data access is restricted through role-based access control.

6. **Third-party services**
    SAFS uses Google Firebase and Google Cloud for authentication, data storage, and server-side functions.
    Google processes data under its terms as a technical provider/processor.

7. **Retention**
    - Data for school administrators and feedback is stored as long as the account exists.
    - Data for classes and student representatives is stored as long as the class exists.
    - When an account/class is deleted, so too does all the data linked to that account.

8. **Rights**
    Under applicable law, you have the right to request access to your personal data, and to request correction or deletion.
    Since SAFS does not intentionally* store personal data beyond email addresses, the amount of data that can be disclosed is limited.
    However, an email address can be deleted on request, together with all data linked to that account.

9. **Updates**
    This text may be updated if the service or legal requirements change.
    The latest version is published in SAFS.

\* *Because users can technically enter personal data in messages or class names, such personal data may be stored.
This is not the intended use of these fields, and it is not the intention to process such data as personal data.
Users are responsible for not entering personal data in these fields.*

** *Firebase Authentication stores passwords as salted cryptographic hashes (not plain text) and verifies sign-ins through hash comparison. SAFS never receives access to plain-text passwords.*
