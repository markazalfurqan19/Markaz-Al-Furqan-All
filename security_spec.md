# Al-Furqaan Markaz Management System — Security Specification

## 1. Security Invariants
1. **Default Deny**: Every Firestore path defaults to `false` unless explicitly permitted by role + record ownership + field validation.
2. **Email Verification & Role Lookup**: Roles are stored strictly in `/users/{uid}` and looked up server-side in Firestore Rules (`get(/databases/$(database)/documents/users/$(request.auth.uid)).data`). Only the bootstrapped Super Admin (`markazalfurqan19@gmail.com` with `email_verified == true`) can self-provision `super_admin`. Any other new user self-creating `/users/{uid}` is locked to `role == 'guardian'` and `active == true`.
3. **No Client Role Escalation**: Non-admin users cannot update their own `role`, `active`, `assignedHalaqahIds`, or `linkedStudentIds`.
4. **Halaqah & Guardian Scoped Reads**:
   - `muallim` reads/writes `hifzLogs` and `attendance` only for their assigned `halaqahIds`.
   - `guardian` reads only students in `linkedStudentIds`, published `exams`, approved `hifzLogs`, `attendance`, and `invoices`/`payments` belonging to their linked children.
5. **Financial Immutability & Separation**:
   - `payments` and `donations` cannot be deleted (`allow delete: if false`). Corrections use `reversalStatus == 'reversed'` with `reversalReason` and `reversedBy`.
   - `pledges` are strictly separated from `donations`.
6. **Public Portal Isolation**:
   - Unauthenticated users may `create` `/admissions` (`status == 'submitted'`, `consentAccepted == true`) and `/pledges` (`status == 'pledged'`), and may `read` `/campaigns` and minimal `/publicCertificates/{token}`.
   - Unauthenticated users can NEVER read `/students`, `/guardians`, `/admissions`, `/payments`, `/staff`, or `/auditLogs`.
7. **Immutable Audit Trail**: `/auditLogs` allows `create` with `actorUid == request.auth.uid`, and forbids `update` and `delete` for all roles including `super_admin`.

## 2. Adversarial Dirty Payloads Tested
1. Self-registration attempting `role: 'super_admin'` as non-bootstrapped email -> REJECTED.
2. User updating own `/users/{uid}` `role` or `linkedStudentIds` -> REJECTED.
3. Unauthenticated user reading `/students` or `/admissions` -> REJECTED.
4. Public admission payload injecting `status: 'accepted'` or missing `consentAccepted: true` -> REJECTED.
5. Mu'allim writing `hifzLogs` for a student in an unassigned `halaqahId` -> REJECTED.
6. Mu'allim attempting to create/modify `payments` or `exams` -> REJECTED.
7. Examiner attempting to create `payments` or delete `exams` -> REJECTED.
8. Guardian attempting to read another child's `students` or `hifzLogs` -> REJECTED.
9. Guardian attempting to read `exams` with `approvalStatus: 'marked'` (unpublished) -> REJECTED.
10. Accountant attempting to `delete` a `payments` receipt document -> REJECTED.
11. Any user attempting to `update` or `delete` `/auditLogs/{id}` -> REJECTED.
12. Oversized `fullName` (> 120 chars) or invalid `receiptNo` pattern in `payments` -> REJECTED.
