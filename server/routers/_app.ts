// Main tRPC App Router
//
// admin      → Dashboard stats, team management, export (used by /admin/* pages)
// auth       → Profile, notifications, session management (post-registration)
// team       → Submission updates, submit for review, withdraw (post-registration)
// logistics  → Event-day operations: attendance, member edits, QR check-in
// email      → Bulk email campaigns: compose, send, track (used by /admin/emails)
//
import { router } from '../trpc';
import { adminRouter } from './admin';
import { adminTeamsRouter } from './admin-teams';
import { teamRouter } from './team';
import { authRouter } from './auth';
import { logisticsRouter } from './logistics';
import { emailRouter } from './email';

export const appRouter = router({
  admin: adminRouter,
  adminTeams: adminTeamsRouter,
  team: teamRouter,
  auth: authRouter,
  logistics: logisticsRouter,
  email: emailRouter,
});

export type AppRouter = typeof appRouter;
