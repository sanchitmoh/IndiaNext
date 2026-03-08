# Edit Form Flow - Security Audit Report

**Date:** March 8, 2026  
**Scope:** Login → Dashboard → Edit Form Flow  
**Status:** 🔴 CRITICAL ISSUES FOUND

---

## Executive Summary

The edit form flow has **CRITICAL SECURITY VULNERABILITIES** that prevent it from functioning properly and expose security risks. The HackathonForm component does not support edit mode, making the entire edit flow non-functional.

### Severity Breakdown

- 🔴 **CRITICAL**: 3 issues
- 🟠 **HIGH**: 2 issues
- 🟡 **MEDIUM**: 3 issues
- 🟢 **LOW**: 2 issues

---

## Flow Analysis

### Current Flow

1. User clicks "Login to edit your form" on registration page
2. User redirected to `/login`
3. User enters email → OTP sent
4. User verifies OTP → Session created (HttpOnly cookie)
5. User redirected to `/dashboard`
6. Dashboard fetches user data via `/api/user/me`
7. Dashboard renders `<HackathonForm />` with props
8. **❌ BROKEN**: HackathonForm doesn't accept props

---

## 🔴 CRITICAL ISSUES

### C-1: HackathonForm Component Doesn't Support Edit Mode

**Severity:** CRITICAL  
**Impact:** Edit functionality completely broken

**Problem:**

```typescript
// Dashboard passes props:
<HackathonForm
  initialData={data}
  isEditMode={true}
  isLocked={!!(data as any).isLocked}
  initialAssignedProblem={assignedProblem}
/>

// But HackathonForm doesn't accept any props:
export default function HackathonForm() {
  // No props parameter!
  const [answers, setAnswers] = useState<Answers>({});
  // Always starts with empty state
}
```

**Consequences:**

- Users cannot edit their registration
- All form data is lost
- Users start from scratch every time
- The entire edit flow is non-functional

**Fix Required:**

```typescript
interface HackathonFormProps {
  initialData?: Record<string, any>;
  isEditMode?: boolean;
  isLocked?: boolean;
  initialAssignedProblem?: any;
}

export default function HackathonForm({
  initialData,
  isEditMode = false,
  isLocked = false,
  initialAssignedProblem,
}: HackathonFormProps = {}) {
  const [answers, setAnswers] = useState<Answers>(initialData || {});
  const [assignedProblem, setAssignedProblem] = useState(initialAssignedProblem);

  // Skip welcome screen in edit mode
  const [started, setStarted] = useState(isEditMode);

  // Skip email verification in edit mode
  const [emailVerified, setEmailVerified] = useState(isEditMode);
  const [verifiedEmail, setVerifiedEmail] = useState(isEditMode ? initialData?.leaderEmail : null);
}
```

---

### C-2: No Visual Indication of Edit Mode

**Severity:** CRITICAL  
**Impact:** User confusion, accidental duplicate registrations

**Problem:**

- Edit mode looks identical to new registration
- No warning that changes are limited (one-time edit)
- No indication that form is locked after first edit
- Users might think they're creating a new team

**Fix Required:**
Add prominent edit mode banner:

```typescript
{isEditMode && (
  <div className="bg-orange-900/20 border-2 border-orange-500 p-6 mb-8">
    <div className="flex items-center gap-3 mb-2">
      <span className="text-2xl">✏️</span>
      <h3 className="text-xl font-bold text-orange-400 uppercase">
        Edit Mode - Updating Existing Registration
      </h3>
    </div>
    <p className="text-slate-300 text-sm mb-2">
      You are editing your existing registration for: <strong>{answers.teamName}</strong>
    </p>
    {!isLocked && (
      <div className="bg-yellow-900/30 border border-yellow-500/50 p-3 mt-3">
        <p className="text-yellow-300 text-xs font-bold">
          ⚠️ WARNING: You can only edit your registration ONCE.
          After submitting changes, your form will be permanently locked.
        </p>
      </div>
    )}
    {isLocked && (
      <div className="bg-red-900/30 border border-red-500/50 p-3 mt-3">
        <p className="text-red-300 text-xs font-bold">
          🔒 LOCKED: This registration has already been edited once and cannot be modified again.
        </p>
      </div>
    )}
  </div>
)}
```

---

### C-3: Locked Forms Can Still Be Submitted

**Severity:** CRITICAL  
**Impact:** Data integrity violation, bypasses business rules

**Problem:**

```typescript
// Dashboard passes isLocked prop
<HackathonForm isLocked={!!(data as any).isLocked} />

// But HackathonForm never checks it before submission
const submitForm = async () => {
  // No isLocked check here!
  const res = await fetch('/api/register', {
    method: 'POST',
    body: JSON.stringify({ ...finalAnswers }),
  });
}
```

**Consequences:**

- Users can bypass one-time edit limit
- Database has protection, but UI should prevent attempts
- Poor UX - users waste time filling form only to get error

**Fix Required:**

```typescript
const submitForm = async () => {
  if (isLocked) {
    setErrorMsg('This registration is locked and cannot be modified.');
    return;
  }

  // Show confirmation dialog in edit mode
  if (isEditMode) {
    const confirmed = window.confirm(
      '⚠️ WARNING: After submitting these changes, your registration will be permanently locked. ' +
        'You will NOT be able to edit it again. Continue?'
    );
    if (!confirmed) return;
  }

  // Proceed with submission...
};
```

---

## 🟠 HIGH SEVERITY ISSUES

### H-1: Email Change in Edit Mode Not Handled

**Severity:** HIGH  
**Impact:** Session/team mismatch, security bypass

**Problem:**

- In edit mode, leader email is pre-filled and verified
- But user can click "Change Email" and enter different email
- This creates session mismatch (logged in as A, editing as B)
- Could allow unauthorized access to other teams

**Current Code:**

```typescript
// Email is pre-verified in edit mode
const [emailVerified, setEmailVerified] = useState(false);
const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

// But resetVerification() allows changing it
const resetVerification = () => {
  setEmailVerified(false);
  setVerifiedEmail(null);
  setAnswers((prev) => ({ ...prev, leaderEmail: '' }));
};
```

**Fix Required:**

```typescript
// In edit mode, leader email should be immutable
{isEditMode ? (
  <div className="w-full">
    <div className="flex items-center gap-4 border-2 border-slate-700 bg-slate-900/50 rounded p-4">
      <div className="flex-1">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
          Team Leader Email (Cannot be changed)
        </div>
        <div className="text-xl md:text-2xl font-mono text-slate-400">
          {initialData?.leaderEmail}
        </div>
      </div>
      <div className="text-xs text-slate-500 font-mono">
        🔒 LOCKED
      </div>
    </div>
    <p className="text-xs text-slate-500 mt-2">
      The team leader email cannot be changed. To transfer leadership, contact support.
    </p>
  </div>
) : (
  // Normal email input with OTP verification
)}
```

---

### H-2: No Logout Button in Edit Flow

**Severity:** HIGH  
**Impact:** Session hijacking risk on shared devices

**Problem:**

- User logs in to edit form
- No visible logout button in HackathonForm
- Session remains active (7 days)
- On shared/public computers, next user has access

**Fix Required:**
Add logout button to form header:

```typescript
{isEditMode && (
  <div className="absolute top-4 right-4 z-50">
    <button
      onClick={async () => {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/';
      }}
      className="text-xs text-slate-500 hover:text-orange-400 font-mono uppercase tracking-wider border border-slate-700 hover:border-orange-500 px-3 py-1.5 transition-all"
    >
      [ LOGOUT ]
    </button>
  </div>
)}
```

---

## 🟡 MEDIUM SEVERITY ISSUES

### M-1: Track Selection Editable in Edit Mode

**Severity:** MEDIUM  
**Impact:** Data inconsistency, business logic violation

**Problem:**

- Track (IdeaSprint vs BuildStorm) is shown as first question
- In edit mode, it's still selectable
- But backend doesn't allow track changes
- Creates confusion and wasted effort

**Fix Required:**

```typescript
if (question.id === 'track' && isEditMode) {
  return (
    <div className="w-full max-w-lg">
      <div className="border-2 border-slate-700 bg-slate-900/50 p-6 rounded">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
          Selected Track (Cannot be changed)
        </div>
        <div className="text-2xl font-bold text-orange-400 uppercase">
          {value}
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-3">
        The competition track cannot be changed after registration.
      </p>
    </div>
  );
}
```

---

### M-2: Problem Statement Re-Assignment Risk

**Severity:** MEDIUM  
**Impact:** Unfair advantage, problem statement leakage

**Problem:**

- BuildStorm track assigns problem statements via round-robin
- In edit mode, if user refreshes or navigates away, might trigger re-assignment
- Could allow users to "shop" for easier problems

**Current Code:**

```typescript
// Auto-fetch problem when reaching buildBrief step
useEffect(() => {
  if (currentQuestion?.id === 'buildBrief' && !assignedProblem && !problemLoading) {
    fetchAssignedProblem(); // ⚠️ Could re-assign in edit mode!
  }
}, [currentQuestion, assignedProblem, problemLoading]);
```

**Fix Required:**

```typescript
useEffect(() => {
  if (
    currentQuestion?.id === 'buildBrief' &&
    !assignedProblem &&
    !problemLoading &&
    !isEditMode // Don't re-fetch in edit mode
  ) {
    fetchAssignedProblem();
  }
}, [currentQuestion, assignedProblem, problemLoading, isEditMode]);

// In edit mode, use initialAssignedProblem
useEffect(() => {
  if (isEditMode && initialAssignedProblem) {
    setAssignedProblem(initialAssignedProblem);
  }
}, [isEditMode, initialAssignedProblem]);
```

---

### M-3: No Diff/Change Tracking

**Severity:** MEDIUM  
**Impact:** Poor UX, no audit trail of what changed

**Problem:**

- Users can't see what they're changing
- No confirmation of changes before submit
- Activity log records update but not specific changes

**Recommendation:**
Add change summary before final submission:

```typescript
const getChangedFields = () => {
  const changes: string[] = [];
  Object.keys(answers).forEach(key => {
    if (initialData?.[key] !== answers[key]) {
      changes.push(key);
    }
  });
  return changes;
};

// Show before submit
{isEditMode && (
  <div className="bg-slate-900 border border-slate-700 p-4 mb-4">
    <h4 className="text-sm font-bold text-orange-400 mb-2">
      Changes to be saved:
    </h4>
    <ul className="text-xs text-slate-400 space-y-1">
      {getChangedFields().map(field => (
        <li key={field}>• {field}</li>
      ))}
    </ul>
  </div>
)}
```

---

## 🟢 LOW SEVERITY ISSUES

### L-1: Session Expiry Not Handled During Edit

**Severity:** LOW  
**Impact:** Data loss if session expires mid-edit

**Problem:**

- Sessions expire after 7 days
- If user takes long time editing, session might expire
- Form submission will fail with no warning
- All changes lost

**Recommendation:**
Add session check before submission:

```typescript
const checkSession = async () => {
  const res = await fetch('/api/user/me');
  return res.ok;
};

const submitForm = async () => {
  const sessionValid = await checkSession();
  if (!sessionValid) {
    setErrorMsg('Your session has expired. Please save your changes and log in again.');
    // Optionally save to localStorage
    localStorage.setItem('draft_edit', JSON.stringify(answers));
    return;
  }
  // Proceed...
};
```

---

### L-2: No "Cancel Edit" Option

**Severity:** LOW  
**Impact:** Poor UX, users might want to discard changes

**Problem:**

- Once in edit mode, no way to cancel
- Users must complete form or close browser
- No "return to dashboard" option

**Recommendation:**

```typescript
{isEditMode && (
  <button
    onClick={() => {
      if (confirm("Discard all changes and return to dashboard?")) {
        window.location.href = '/dashboard';
      }
    }}
    className="text-slate-500 hover:text-slate-300 text-sm uppercase"
  >
    [ CANCEL & RETURN ]
  </button>
)}
```

---

## Security Best Practices - Compliance Check

### ✅ PASSED

1. **Session Management**: HttpOnly cookies used correctly
2. **OTP Security**: Hashed storage, rate limiting, expiry
3. **CSRF Protection**: SameSite=lax cookies
4. **Rate Limiting**: Implemented on all auth endpoints
5. **Input Validation**: Zod schemas on all inputs
6. **SQL Injection**: Prisma ORM prevents SQL injection
7. **XSS Protection**: Input sanitization implemented
8. **One-Time Edit**: Database-level lock via activity logs

### ❌ FAILED

1. **Edit Mode Implementation**: Completely non-functional
2. **Authorization Checks**: Missing in UI layer
3. **User Feedback**: No clear indication of edit mode/locked state
4. **Session Expiry Handling**: Not handled during long edits
5. **Audit Trail**: No detailed change tracking

---

## Industry Standards Comparison

### OWASP Top 10 (2021)

- ✅ A01: Broken Access Control - **Backend protected**, UI broken
- ✅ A02: Cryptographic Failures - Session tokens hashed
- ✅ A03: Injection - Prisma ORM + validation
- ❌ A04: Insecure Design - **Edit flow not designed properly**
- ✅ A05: Security Misconfiguration - Proper cookie settings
- ✅ A07: Identification/Auth Failures - OTP + rate limiting
- ❌ A08: Software/Data Integrity - **No change tracking**

### CWE Top 25

- ❌ CWE-862: Missing Authorization - **UI doesn't check isLocked**
- ✅ CWE-798: Hard-coded Credentials - None found
- ✅ CWE-89: SQL Injection - Prisma prevents
- ✅ CWE-79: XSS - Sanitization implemented
- ❌ CWE-287: Improper Authentication - **Email change in edit mode**

---

## Recommended Fix Priority

### Phase 1: Critical Fixes (MUST FIX BEFORE LAUNCH)

1. **Add props support to HackathonForm** (C-1)
2. **Add edit mode banner** (C-2)
3. **Add isLocked check before submission** (C-3)
4. **Lock leader email in edit mode** (H-1)

### Phase 2: High Priority (FIX ASAP)

5. **Add logout button** (H-2)
6. **Lock track selection in edit mode** (M-1)
7. **Prevent problem re-assignment** (M-2)

### Phase 3: Nice to Have

8. **Add change tracking** (M-3)
9. **Add session expiry handling** (L-1)
10. **Add cancel button** (L-2)

---

## Testing Checklist

### Functional Testing

- [ ] User can log in with OTP
- [ ] Dashboard loads existing data
- [ ] Form pre-fills with user data
- [ ] Edit mode banner shows
- [ ] Locked state prevents submission
- [ ] Changes save successfully
- [ ] Second edit attempt blocked
- [ ] Logout works correctly

### Security Testing

- [ ] Cannot edit other team's data
- [ ] Cannot change leader email
- [ ] Cannot change track
- [ ] Cannot bypass one-time edit limit
- [ ] Session expires after 7 days
- [ ] Rate limiting works on all endpoints
- [ ] XSS attempts sanitized
- [ ] SQL injection attempts blocked

### UX Testing

- [ ] Clear indication of edit mode
- [ ] Warning before final submission
- [ ] Error messages are helpful
- [ ] Loading states show properly
- [ ] Mobile responsive
- [ ] Keyboard navigation works

---

## Conclusion

The edit form flow has **critical implementation gaps** that make it completely non-functional. The HackathonForm component must be refactored to accept props and handle edit mode properly. Additionally, several security and UX improvements are needed to meet industry standards.

**Estimated Fix Time:** 4-6 hours for Phase 1 critical fixes

**Risk Level if Deployed As-Is:** 🔴 **CRITICAL** - Users cannot edit registrations, defeating the purpose of the login flow.
