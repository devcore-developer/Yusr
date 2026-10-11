export type UserRole = 'SUPER_ADMIN' | 'SCHOOL_MANAGER' | 'BRANCH_MANAGER' | 'QUALITY_ASSESSOR';
export type SchoolStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'PENDING';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'SUSPENDED';
export type AssessmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type GapSeverity = 'HIGH' | 'MEDIUM' | 'LOW';
export type GapStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export interface Domain { id: string; name: string; description: string; }
export interface Axis { id: string; domainId: string; name: string; }
export interface Indicator { id: string; axisId: string; code: string; description: string; targetStatus: string; guidePage: number; }

export interface Branch {
  id: string;
  schoolId: string;
  name: string;
  location: string;
  manager: string;
  userCount: number;
  qualityScore: number;
  assessmentProgress: number;
  status: SchoolStatus;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  schoolId?: string;
  branchId?: string;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  lastActivity: string;
}

export interface Subscription {
  id: string;
  schoolId: string;
  plan: 'Basic' | 'Pro' | 'Enterprise';
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  remainingDays: number;
}

export interface School {
  id: string;
  name: string;
  logoUrl?: string;
  description: string;
  location: string;
  contactPhone: string;
  contactEmail: string;
  managerId: string;
  branchCount: number;
  userCount: number;
  assessmentProgress: number;
  qualityScore: number;
  subscriptionStatus: SubscriptionStatus;
  status: SchoolStatus;
  lastAssessment: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  type: 'NEW_SCHOOL' | 'ASSESSMENT_COMPLETED' | 'REPORT_GENERATED' | 'SUBSCRIPTION_RENEWED' | 'USER_ADDED' | 'BRANCH_CREATED' | 'EVIDENCE_UPLOADED';
  description: string;
  timestamp: string;
  actor: string;
}

export interface Alert {
  id: string;
  severity: 'WARNING' | 'DANGER';
  message: string;
  schoolName: string;
}

export interface Gap {
  id: string;
  schoolId: string;
  branchId?: string;
  domainId: string;
  indicatorCode: string;
  description: string;
  severity: GapSeverity;
  status: GapStatus;
  createdAt: string;
}

export interface ImprovementPlan {
  id: string;
  schoolId: string;
  branchId?: string;
  gapId: string;
  status: 'ON_TRACK' | 'AT_RISK' | 'DELAYED';
  progress: number;
  assignee: string;
  deadline: string;
  updatedAt: string;
}

export interface Assessment {
  id: string;
  schoolId: string;
  branchId: string;
  assessorId: string;
  status: AssessmentStatus;
  progress: number;
  score: number;
  startedAt: string;
  completedAt?: string;
}