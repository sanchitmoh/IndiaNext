/**
 * Role-Based Access Control (RBAC) for Admin Panel
 * 
 * Defines permissions for each admin role:
 * - SUPER_ADMIN: Full access to everything
 * - ADMIN: Full access except user management
 * - ORGANIZER: Can manage teams, view analytics
 * - JUDGE: Can only view teams and add scores/comments
 * - LOGISTICS: Event-day role — view approved teams, edit members, mark attendance
 */

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'ORGANIZER' | 'JUDGE' | 'LOGISTICS';

export interface Permission {
  // Dashboard
  viewDashboard: boolean;
  
  // Teams
  viewTeams: boolean;
  editTeams: boolean;
  deleteTeams: boolean;
  exportTeams: boolean;
  bulkActions: boolean;
  
  // Submissions
  viewSubmissions: boolean;
  scoreSubmissions: boolean;
  commentOnSubmissions: boolean;
  
  // Problem Statements
  viewProblems: boolean;
  createProblems: boolean;
  editProblems: boolean;
  deleteProblems: boolean;
  toggleProblems: boolean;
  
  // Analytics
  viewAnalytics: boolean;
  exportAnalytics: boolean;
  
  // Admin Management
  manageAdmins: boolean;
  viewActivityLogs: boolean;
  
  // Logistics (event-day)
  editMembers: boolean;
  swapMembers: boolean;
  markAttendance: boolean;
  viewAttendance: boolean;
}

/**
 * Get permissions for a given role
 */
export function getPermissions(role: AdminRole): Permission {
  const permissions: Record<AdminRole, Permission> = {
    SUPER_ADMIN: {
      viewDashboard: true,
      viewTeams: true,
      editTeams: true,
      deleteTeams: true,
      exportTeams: true,
      bulkActions: true,
      viewSubmissions: true,
      scoreSubmissions: true,
      commentOnSubmissions: true,
      viewProblems: true,
      createProblems: true,
      editProblems: true,
      deleteProblems: true,
      toggleProblems: true,
      viewAnalytics: true,
      exportAnalytics: true,
      manageAdmins: true,
      viewActivityLogs: true,
      editMembers: true,
      swapMembers: true,
      markAttendance: true,
      viewAttendance: true,
    },
    ADMIN: {
      viewDashboard: true,
      viewTeams: true,
      editTeams: true,
      deleteTeams: true,
      exportTeams: true,
      bulkActions: true,
      viewSubmissions: true,
      scoreSubmissions: true,
      commentOnSubmissions: true,
      viewProblems: true,
      createProblems: true,
      editProblems: true,
      deleteProblems: true,
      toggleProblems: true,
      viewAnalytics: true,
      exportAnalytics: true,
      manageAdmins: false,
      viewActivityLogs: true,
      editMembers: true,
      swapMembers: true,
      markAttendance: true,
      viewAttendance: true,
    },
    ORGANIZER: {
      viewDashboard: true,
      viewTeams: true,
      editTeams: true,
      deleteTeams: false,
      exportTeams: true,
      bulkActions: true,
      viewSubmissions: true,
      scoreSubmissions: false,
      commentOnSubmissions: true,
      viewProblems: true,
      createProblems: false,
      editProblems: false,
      deleteProblems: false,
      toggleProblems: false,
      viewAnalytics: true,
      exportAnalytics: true,
      manageAdmins: false,
      viewActivityLogs: false,
      editMembers: false,
      swapMembers: false,
      markAttendance: false,
      viewAttendance: true,
    },
    JUDGE: {
      viewDashboard: false,
      viewTeams: true,
      editTeams: false,
      deleteTeams: false,
      exportTeams: false,
      bulkActions: false,
      viewSubmissions: true,
      scoreSubmissions: true,
      commentOnSubmissions: true,
      viewProblems: false,
      createProblems: false,
      editProblems: false,
      deleteProblems: false,
      toggleProblems: false,
      viewAnalytics: false,
      exportAnalytics: false,
      manageAdmins: false,
      viewActivityLogs: false,
      editMembers: false,
      swapMembers: false,
      markAttendance: false,
      viewAttendance: false,
    },
    LOGISTICS: {
      viewDashboard: false,
      viewTeams: true,       // Can see approved teams
      editTeams: false,      // Cannot change team status
      deleteTeams: false,
      exportTeams: false,
      bulkActions: false,
      viewSubmissions: false,
      scoreSubmissions: false,
      commentOnSubmissions: false,
      viewProblems: false,
      createProblems: false,
      editProblems: false,
      deleteProblems: false,
      toggleProblems: false,
      viewAnalytics: false,
      exportAnalytics: false,
      manageAdmins: false,
      viewActivityLogs: false,
      editMembers: true,     // Can edit non-leader member info
      swapMembers: true,     // Can replace non-leader members
      markAttendance: true,  // Can mark present/absent
      viewAttendance: true,  // Can view attendance status
    },
  };

  return permissions[role];
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: AdminRole, permission: keyof Permission): boolean {
  const permissions = getPermissions(role);
  return permissions[permission];
}

/**
 * Get allowed navigation items for a role
 */
export function getAllowedNavItems(role: AdminRole) {
  const permissions = getPermissions(role);
  
  const allNavItems = [
    { 
      href: "/admin", 
      label: "DASHBOARD", 
      code: "01", 
      permission: 'viewDashboard' as keyof Permission,
    },
    { 
      href: "/admin/teams", 
      label: "TEAMS", 
      code: "02", 
      permission: 'viewTeams' as keyof Permission,
    },
    { 
      href: "/admin/problem-statements", 
      label: "PROBLEMS", 
      code: "03", 
      permission: 'viewProblems' as keyof Permission,
    },
    { 
      href: "/admin/analytics", 
      label: "ANALYTICS", 
      code: "04", 
      permission: 'viewAnalytics' as keyof Permission,
    },
    {
      href: "/admin/logistics",
      label: "LOGISTICS",
      code: "05",
      permission: 'markAttendance' as keyof Permission,
    },
    {
      href: "/admin/emails",
      label: "EMAILS",
      code: "06",
      permission: 'bulkActions' as keyof Permission,
    },
  ];

  return allNavItems.filter(item => permissions[item.permission]);
}

/**
 * Middleware helper to check permissions in API routes
 */
export function requirePermission(adminRole: AdminRole, permission: keyof Permission): boolean {
  return hasPermission(adminRole, permission);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: AdminRole): string {
  const names: Record<AdminRole, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    ORGANIZER: 'Organizer',
    JUDGE: 'Judge',
    LOGISTICS: 'Logistics',
  };
  return names[role];
}

/**
 * Get role description
 */
export function getRoleDescription(role: AdminRole): string {
  const descriptions: Record<AdminRole, string> = {
    SUPER_ADMIN: 'Full system access including user management',
    ADMIN: 'Full access to teams, problems, and analytics',
    ORGANIZER: 'Can manage teams and view analytics',
    JUDGE: 'Can view teams and score submissions',
    LOGISTICS: 'Event-day: view approved teams, edit members, mark attendance',
  };
  return descriptions[role];
}
