# TASKS — SolFoundry bounty #825 toast notification system

Goal: narrow frontend PR for issue #825: reusable toast system with variants, auto-dismiss, stacking, accessibility, and key-action integration.

## In Progress
- [ ] T4. Push PR and log progress.

## Completed
- [x] Branch `feat/toast-notifications` created from `upstream/main`.
- [x] T1. Add ToastProvider/useToast with success/error/warning/info variants.
      Result: global provider, stacked top-right toasts, manual close, 5s auto-dismiss, accessible role=alert.
- [x] T2. Integrate toasts into key submission/copy actions.
      Result: submission fee verification success/failure, submission success/failure, and treasury-address copy now emit toasts.
- [x] T3. Add focused tests and run build.
      Verification: `cd frontend && npx vitest run src/__tests__/toast.test.ts` PASS; `cd frontend && npm run build` PASS.
