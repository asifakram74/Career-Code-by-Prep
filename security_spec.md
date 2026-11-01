# Career Guide by Prep Titans - Security & ABAC Specification

## 1. Data Invariants

1. **Role Boundary & Non-Self-Promotion**:
   - A newly registering user cannot set their role to `normal_admin`, `expert_admin`, or `super_admin`.
   - A user cannot modify their own `role`, `status`, or permissions in Firestore.
   - Only a `super_admin` or trusted server context can assign `expert_admin` or `super_admin` roles.
   - An `expert_admin` can manage normal admins, but cannot promote, deactivate, or create an `expert_admin` or `super_admin`.

2. **Query Ownership & Access Control**:
   - A student can only create queries where `studentId == request.auth.uid`.
   - A student can only view and read queries where `studentId == request.auth.uid`.
   - A normal admin can only view queries assigned to them (`expertId == request.auth.uid`).
   - Expert admins and Super admins can view all queries for operational auditing and routing.

3. **Message Thread Integrity**:
   - A message in a query can only be sent by the student who owns the query or the assigned administrator (or higher admin).
   - Sender cannot spoof `senderId` - it must match `request.auth.uid`.
   - Messages are append-only; existing messages cannot be edited or tampered with.

4. **15-Day History and Saved Answers**:
   - Regular queries appear in history for 15 days on the client UI.
   - Saved answers can be created and read only by the owner (`studentId == request.auth.uid`).

5. **Category Management**:
   - Only authorized admins (`expert_admin` or `super_admin`) can create or modify categories.
   - Deleting a category with active queries is guarded.

6. **PII Isolation**:
   - User profile PII (phone number, email) is only readable by the owner or authorized admins.

---

## 2. The "Dirty Dozen" Threat Payloads (Must be Denied)

1. **Self-Promote to Super Admin on Registration**:
   `{ uid: "attacker123", email: "hacker@test.com", displayName: "Hacker", role: "super_admin" }` -> DENIED.
2. **Student Spoofing Another Student's Query**:
   `{ studentId: "victim456", expertId: "admin1", title: "Compromise", detail: "Spam" }` where `auth.uid == "attacker123"` -> DENIED.
3. **Ghost / Shadow Field Injection on Query**:
   `{ studentId: "attacker123", title: "Valid", detail: "Valid", isApprovedBypass: true }` -> DENIED.
4. **Normal Admin Viewing Unassigned Student Queries**:
   Querying `/queries` where `expertId != adminUid` and user is `normal_admin` -> DENIED.
5. **Normal Admin Creating an Admin Account**:
   Normal admin writing to `/users` or `/admins` -> DENIED.
6. **Expert Admin Creating or Promoting an Expert Admin**:
   Expert admin attempting to set role `expert_admin` on another user -> DENIED.
7. **Tampering with Message Sender Identity**:
   `{ queryId: "q1", senderId: "trusted_expert", content: "Pay $100 to this link" }` where `auth.uid != "trusted_expert"` -> DENIED.
8. **Student Modifying Query Assigned Expert**:
   Student updating `expertId` on existing ticket -> DENIED.
9. **Student Modifying Ticket Status to Resolved**:
   Student updating status bypassing workflow without authorization -> DENIED.
10. **Unauthenticated Reading of Student Queries**:
    Guest fetching `/queries/{id}` -> DENIED.
11. **Injecting 2MB payload into query title**:
    `{ title: "A".repeat(2000000), ... }` -> DENIED.
12. **Student Reading Other Student's Notifications**:
    Student fetching `/notifications` where `userId != auth.uid` -> DENIED.
