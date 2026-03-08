# Critical Fixes Implementation Guide

**Priority:** URGENT - Must fix before launch  
**Estimated Time:** 4-6 hours

---

## Fix 1: Add Props Support to HackathonForm (C-1)

### Current Problem

```typescript
export default function HackathonForm() {
  // No props - always starts empty!
}
```

### Solution

Add props interface and use initialData:

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
  // Initialize with provided data
  const [answers, setAnswers] = useState<Answers>(initialData || {});

  // Skip welcome screen in edit mode
  const [started, setStarted] = useState(isEditMode);

  // Pre-verify email in edit mode
  const [emailVerified, setEmailVerified] = useState(isEditMode);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(
    isEditMode ? (initialData?.leaderEmail as string) : null
  );

  // Use provided problem statement
  const [assignedProblem, setAssignedProblem] = useState(initialAssignedProblem || null);

  // Don't fetch problem in edit mode
  useEffect(() => {
    if (
      currentQuestion?.id === 'buildBrief' &&
      !assignedProblem &&
      !problemLoading &&
      !isEditMode // Add this check
    ) {
      fetchAssignedProblem();
    }
  }, [currentQuestion, assignedProblem, problemLoading, isEditMode]);

  // Set initial problem in edit mode
  useEffect(() => {
    if (isEditMode && initialAssignedProblem && !assignedProblem) {
      setAssignedProblem(initialAssignedProblem);
    }
  }, [isEditMode, initialAssignedProblem, assignedProblem]);
}
```

---

## Fix 2: Add Edit Mode Banner (C-2)

Add this at the top of the form (after the folder header):

```typescript
{isEditMode && (
  <motion.div
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    className="mb-6 bg-orange-900/20 border-2 border-orange-500 rounded p-6"
  >
    <div className="flex items-center gap-3 mb-3">
      <span className="text-3xl">✏️</span>
      <h3 className="text-xl md:text-2xl font-bold text-orange-400 uppercase tracking-tight">
        Edit Mode - Updating Registration
      </h3>
    </div>

    <div className="space-y-2 text-sm">
      <p className="text-slate-300">
        You are editing your existing registration for team:
        <strong className="text-white ml-2">{answers.teamName}</strong>
      </p>

      {!isLocked ? (
        <div className="bg-yellow-900/30 border border-yellow-500/50 rounded p-4 mt-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-yellow-300 font-bold mb-1 uppercase text-xs tracking-wider">
                One-Time Edit Warning
              </p>
              <p className="text-yellow-200 text-xs leading-relaxed">
                You can only edit your registration <strong>ONCE</strong>.
                After submitting these changes, your form will be permanently locked.
                Make sure all information is correct before proceeding.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-red-900/30 border border-red-500/50 rounded p-4 mt-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="text-red-300 font-bold mb-1 uppercase text-xs tracking-wider">
                Registration Locked
              </p>
              <p className="text-red-200 text-xs leading-relaxed">
                This registration has already been edited once and is now permanently locked.
                No further changes can be made. If you need to make changes, please contact support.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  </motion.div>
)}
```

---

## Fix 3: Add isLocked Check Before Submission (C-3)

Update the `handleNext` function:

```typescript
const handleNext = React.useCallback(async () => {
  // ... existing validation code ...

  const nextStep = getNextValidStep(currentStep, 1, answers);

  if (nextStep < totalSteps) {
    setDirection(1);
    setCurrentStep(nextStep);
    setErrorMsg('');
  } else {
    // About to submit - check if locked
    if (isLocked) {
      setErrorMsg(
        'This registration is locked and cannot be modified. ' +
          'You have already used your one-time edit.'
      );
      return;
    }

    // In edit mode, show confirmation
    if (isEditMode) {
      const confirmed = window.confirm(
        '⚠️ FINAL WARNING\n\n' +
          'After submitting these changes, your registration will be PERMANENTLY LOCKED.\n' +
          'You will NOT be able to edit it again.\n\n' +
          'Are you absolutely sure you want to proceed?'
      );

      if (!confirmed) {
        return;
      }
    }

    await submitForm();
  }
}, [
  currentQuestion,
  answers,
  emailVerified,
  currentStep,
  totalSteps,
  sendOtp,
  submitForm,
  getNextValidStep,
  assignedProblem,
  problemLoading,
  isLocked,
  isEditMode,
]); // Add isLocked and isEditMode to dependencies
```

---

## Fix 4: Lock Leader Email in Edit Mode (H-1)

Update the `InputRenderer` component for email field:

```typescript
// Inside InputRenderer function, add this check at the beginning:
if (question.id === 'leaderEmail' && isEditMode) {
  return (
    <div className="w-full space-y-4">
      {/* Locked Email Display */}
      <div className="border-2 border-slate-700 bg-slate-900/50 rounded p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">
            Team Leader Email
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>🔒</span>
            <span>LOCKED</span>
          </div>
        </div>
        <div className="text-xl md:text-2xl font-mono text-slate-300 tracking-wide">
          {value || initialData?.leaderEmail}
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded p-4">
        <p className="text-xs text-slate-400 leading-relaxed">
          <strong className="text-orange-400">Security Notice:</strong> The team leader email
          cannot be changed after registration. This ensures account security and prevents
          unauthorized access. If you need to transfer team leadership, please contact support.
        </p>
      </div>
    </div>
  );
}

// Update InputRenderer props to include isEditMode and initialData
const InputRenderer = ({
  question,
  value,
  onChange,
  onCheckbox,
  answers,
  isEditMode, // Add this
  initialData, // Add this
  // ... other props
}: {
  question: Question;
  value: string | string[] | undefined;
  onChange: (val: string | string[]) => void;
  onCheckbox: (opt: string) => void;
  answers: Answers;
  isEditMode?: boolean; // Add this
  initialData?: Record<string, any>; // Add this
  // ... other props
}) => {
  // ... rest of the function
}
```

Then update where InputRenderer is called:

```typescript
<InputRenderer
  question={currentQuestion}
  value={answers[currentQuestion.id]}
  onChange={handleAnswer}
  onCheckbox={handleCheckbox}
  answers={answers}
  isEditMode={isEditMode} // Add this
  initialData={initialData} // Add this
  emailVerified={emailVerified}
  verifiedEmail={verifiedEmail}
  // ... other props
/>
```

---

## Fix 5: Lock Track Selection in Edit Mode (M-1)

Update the track selection rendering:

```typescript
if (question.type === 'choice') {
  // Check if this is track selection in edit mode
  if (question.id === 'track' && isEditMode) {
    return (
      <div className="w-full max-w-lg">
        <div className="border-2 border-slate-700 bg-slate-900/50 rounded p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">
              Competition Track
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <span>🔒</span>
              <span>LOCKED</span>
            </div>
          </div>
          <div className="text-xl md:text-2xl font-bold text-orange-400 uppercase tracking-tight">
            {value}
          </div>
        </div>

        <div className="mt-4 bg-slate-800/50 border border-slate-700 rounded p-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            The competition track cannot be changed after registration.
            Each track has different requirements and judging criteria.
          </p>
        </div>
      </div>
    );
  }

  // Normal choice rendering for other questions or new registrations
  return (
    <div className="flex flex-col gap-2 max-w-lg w-full">
      {question.options?.map((opt: string, _idx: number) => (
        <OptionButton
          key={opt}
          opt={opt}
          selected={value === opt}
          onSelect={() => onChange(opt)}
        />
      ))}
      {question.id === 'track' && !isEditMode && (
        <div className="mt-4 text-xs text-slate-500 font-mono border-t border-slate-800 pt-3">
          <p className="mb-2">Need to edit your registration?</p>
          <Link
            href="/login"
            className="text-orange-500 hover:text-orange-400 underline transition-colors"
          >
            Login to edit your form
          </Link>
        </div>
      )}
    </div>
  );
}
```

---

## Fix 6: Add Logout Button (H-2)

Add logout button to the form header:

```typescript
{isEditMode && (
  <div className="absolute top-4 right-4 z-50">
    <button
      onClick={async () => {
        if (confirm("Are you sure you want to logout? Any unsaved changes will be lost.")) {
          try {
            await fetch('/api/logout', {
              method: 'POST',
              credentials: 'include'
            });
            window.location.href = '/';
          } catch (err) {
            console.error('Logout failed:', err);
            // Force redirect anyway
            window.location.href = '/';
          }
        }
      }}
      className="flex items-center gap-2 text-xs text-slate-500 hover:text-orange-400 font-mono uppercase tracking-wider border border-slate-700 hover:border-orange-500 px-4 py-2 transition-all rounded"
    >
      <span>🚪</span>
      <span>[ LOGOUT ]</span>
    </button>
  </div>
)}
```

---

## Testing Checklist

After implementing these fixes, test:

### Registration Flow (New Users)

- [ ] Welcome screen shows
- [ ] Track selection works
- [ ] Email OTP verification works
- [ ] Form submits successfully
- [ ] "Login to edit" link shows on track question

### Edit Flow (Existing Users)

- [ ] Login page works
- [ ] OTP verification works
- [ ] Dashboard loads user data
- [ ] Form pre-fills with existing data
- [ ] Edit mode banner shows
- [ ] Track is locked (not editable)
- [ ] Leader email is locked (not editable)
- [ ] Other fields are editable
- [ ] Warning shows before final submit
- [ ] Changes save successfully
- [ ] Logout button works

### Locked State (After First Edit)

- [ ] Dashboard shows locked state
- [ ] Form shows "LOCKED" banner
- [ ] Submit button is disabled or shows error
- [ ] Clear message explains why locked

### Security

- [ ] Cannot edit without login
- [ ] Cannot edit other team's data
- [ ] Cannot bypass one-time edit limit
- [ ] Session expires properly
- [ ] Logout clears session

---

## Deployment Notes

1. **Database**: No schema changes needed
2. **Environment**: No new env vars needed
3. **Breaking Changes**: None - only adds functionality
4. **Rollback**: Safe - changes are additive

## Support Impact

After deployment, users will be able to:

- ✅ Edit their registration once
- ✅ See clear warnings about one-time edit
- ✅ Understand when form is locked
- ✅ Logout securely

This should **reduce support tickets** about:

- "I can't edit my registration"
- "I didn't know I could only edit once"
- "My changes didn't save"
