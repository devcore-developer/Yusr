import { Branch, User, Gap, ImprovementPlan, Assessment, Domain } from '@/types';

export const schoolDomains: Domain[] = [
  { id: 'D1', name: 'الإدارة المدرسية', description: 'إدارة المدرسة والقيادة التربوية' },
  { id: 'D2', name: 'التعليم والتعلم', description: 'ممارسات التدريس والتعلم' },
  { id: 'D3', name: 'نواتج التعلم', description: 'تحصيل الطلاب ومهاراتهم' },
  { id: 'D4', name: 'البيئة المدرسية', description: 'البيئة الفيزيائية والنفسية' },
];

export const initialSchoolBranches: Branch[] = [
  { id: 'B1', schoolId: 'S1', name: 'الفرع الرئيسي (حي النخيل)', location: 'الرياض - حي النخيل', manager: 'أحمد العتيبي', userCount: 60, qualityScore: 92, assessmentProgress: 80, status: 'ACTIVE' },
  { id: 'B2', schoolId: 'S1', name: 'فرع حي الياسمين', location: 'الرياض - حي الياسمين', manager: 'سارة القحطاني', userCount: 45, qualityScore: 85, assessmentProgress: 50, status: 'ACTIVE' },
  { id: 'B3', schoolId: 'S1', name: 'فرع حي الملقا', location: 'الرياض - حي الملقا', manager: 'خالد الدوسري', userCount: 30, qualityScore: 70, assessmentProgress: 20, status: 'PENDING' },
];

export const initialSchoolUsers: User[] = [
  { id: 'U1', name: 'محمد الزهراني', email: 'mohamed@future.sch', role: 'SCHOOL_MANAGER', schoolId: 'S1', status: 'ACTIVE', lastActivity: '2024-05-19T10:00:00Z' },
  { id: 'U2', name: 'أحمد العتيبي', email: 'ahmed@future.sch', role: 'BRANCH_MANAGER', schoolId: 'S1', branchId: 'B1', status: 'ACTIVE', lastActivity: '2024-05-18T14:00:00Z' },
  { id: 'U3', name: 'سارة القحطاني', email: 'sara@future.sch', role: 'BRANCH_MANAGER', schoolId: 'S1', branchId: 'B2', status: 'ACTIVE', lastActivity: '2024-05-17T09:00:00Z' },
  { id: 'U4', name: 'نورة السبيعي', email: 'noura@future.sch', role: 'QUALITY_ASSESSOR', schoolId: 'S1', status: 'ACTIVE', lastActivity: '2024-05-20T08:00:00Z' },
  { id: 'U5', name: 'فهد الحربي', email: 'fahad@future.sch', role: 'QUALITY_ASSESSOR', schoolId: 'S1', branchId: 'B3', status: 'INVITED', lastActivity: '2024-05-10T12:00:00Z' },
];

export const initialSchoolGaps: Gap[] = [
  { id: 'G1', schoolId: 'S1', branchId: 'B2', domainId: 'D2', indicatorCode: '2.1.3', description: 'غياب التغذية الراجعة الفورية للطلاب', severity: 'MEDIUM', status: 'OPEN', createdAt: '2024-04-22' },
  { id: 'G2', schoolId: 'S1', branchId: 'B3', domainId: 'D1', indicatorCode: '1.2.1', description: 'عدم تفعيل نظام الحوكمة الإلكترونية', severity: 'HIGH', status: 'OPEN', createdAt: '2024-04-15' },
  { id: 'G3', schoolId: 'S1', branchId: 'B1', domainId: 'D4', indicatorCode: '4.3.2', description: 'نقص في معايير السلامة في المختبرات', severity: 'HIGH', status: 'IN_PROGRESS', createdAt: '2024-03-20' },
];

export const initialSchoolPlans: ImprovementPlan[] = [
  { id: 'P1', schoolId: 'S1', branchId: 'B2', gapId: 'G1', status: 'ON_TRACK', progress: 40, assignee: 'سارة القحطاني', deadline: '2024-06-30', updatedAt: '2024-05-10' },
  { id: 'P2', schoolId: 'S1', branchId: 'B1', gapId: 'G3', status: 'AT_RISK', progress: 20, assignee: 'أحمد العتيبي', deadline: '2024-05-25', updatedAt: '2024-05-05' },
];

export const initialSchoolAssessments: Assessment[] = [
  { id: 'A1', schoolId: 'S1', branchId: 'B1', assessorId: 'U4', status: 'IN_PROGRESS', progress: 80, score: 0, startedAt: '2024-05-01' },
  { id: 'A2', schoolId: 'S1', branchId: 'B2', assessorId: 'U4', status: 'COMPLETED', progress: 100, score: 85, startedAt: '2024-04-01', completedAt: '2024-04-15' },
  { id: 'A3', schoolId: 'S1', branchId: 'B3', assessorId: 'U5', status: 'NOT_STARTED', progress: 0, score: 0, startedAt: '2024-05-20' },
];