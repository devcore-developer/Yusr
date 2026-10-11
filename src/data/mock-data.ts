import { School, Branch, User, Subscription, Activity, Alert, Gap, ImprovementPlan, Domain } from '@/types';

export const domains: Domain[] = [
  { id: 'D1', name: 'الإدارة المدرسية', description: 'إدارة المدرسة والقيادة التربوية' },
  { id: 'D2', name: 'التعليم والتعلم', description: 'ممارسات التدريس والتعلم' },
  { id: 'D3', name: 'نواتج التعلم', description: 'تحصيل الطلاب ومهاراتهم' },
  { id: 'D4', name: 'البيئة المدرسية', description: 'البيئة الفيزيائية والنفسية' },
];

export const initialSchools: School[] = [
  { id: 'S1', name: 'مدارس المستقبل الأهلية', location: 'الرياض - حي النخيل', contactPhone: '+966501234567', contactEmail: 'info@future.sch', managerId: 'U1', description: 'مدارس رائدة في التعليم الحديث', branchCount: 4, userCount: 120, assessmentProgress: 80, qualityScore: 92, subscriptionStatus: 'ACTIVE', status: 'ACTIVE', lastAssessment: '2024-05-10', createdAt: '2023-08-01' },
  { id: 'S2', name: 'مدارس النخبة الدولية', location: 'جدة - حي الشاطئ', contactPhone: '+966502345678', contactEmail: 'admin@elite.sch', managerId: 'U2', description: 'تعليم دولي بمعايير عالية', branchCount: 2, userCount: 85, assessmentProgress: 45, qualityScore: 78, subscriptionStatus: 'EXPIRING_SOON', status: 'ACTIVE', lastAssessment: '2024-04-22', createdAt: '2023-09-15' },
  { id: 'S3', name: 'مدارس الأجيال', location: 'الدمام - حي الفيصلية', contactPhone: '+966503456789', contactEmail: 'info@gen.sch', managerId: 'U3', description: 'إعداد جيل متميز أكاديمياً', branchCount: 1, userCount: 40, assessmentProgress: 10, qualityScore: 65, subscriptionStatus: 'SUSPENDED', status: 'SUSPENDED', lastAssessment: '2024-01-15', createdAt: '2023-11-20' },
  { id: 'S4', name: 'مدارس الرياض النموذجية', location: 'الرياض - حي الملقا', contactPhone: '+966504567890', contactEmail: 'admin@riyadh.sch', managerId: 'U4', description: 'نموذجية في البيئة والمناهج', branchCount: 6, userCount: 210, assessmentProgress: 100, qualityScore: 95, subscriptionStatus: 'ACTIVE', status: 'ACTIVE', lastAssessment: '2024-05-18', createdAt: '2022-09-01' },
];

export const initialBranches: Branch[] = [
  { id: 'B1', schoolId: 'S1', name: 'فرع حي النخيل الرئيسي', location: 'الرياض', manager: 'أحمد العتيبي', userCount: 60, qualityScore: 92, assessmentProgress: 80, status: 'ACTIVE' },
  { id: 'B2', schoolId: 'S1', name: 'فرع حي الياسمين', location: 'الرياض', manager: 'سارة القحطاني', userCount: 60, qualityScore: 90, assessmentProgress: 85, status: 'ACTIVE' },
  { id: 'B3', schoolId: 'S4', name: 'فرع الملقا', location: 'الرياض', manager: 'خالد الدوسري', userCount: 120, qualityScore: 95, assessmentProgress: 100, status: 'ACTIVE' },
];

export const initialUsers: User[] = [
  { id: 'U1', name: 'محمد الزهراني', email: 'mohamed@future.sch', role: 'SCHOOL_MANAGER', schoolId: 'S1', status: 'ACTIVE', lastActivity: '2024-05-19T10:00:00Z' },
  { id: 'U2', name: 'فاطمة الغامدي', email: 'fatima@elite.sch', role: 'SCHOOL_MANAGER', schoolId: 'S2', status: 'ACTIVE', lastActivity: '2024-05-18T14:00:00Z' },
  { id: 'U3', name: 'عبدالله الحربي', email: 'abdullah@gen.sch', role: 'SCHOOL_MANAGER', schoolId: 'S3', status: 'SUSPENDED', lastActivity: '2024-04-10T09:00:00Z' },
  { id: 'U4', name: 'نورة السبيعي', email: 'noura@riyadh.sch', role: 'SCHOOL_MANAGER', schoolId: 'S4', status: 'ACTIVE', lastActivity: '2024-05-20T08:00:00Z' },
  { id: 'U5', name: 'سلمان الشهري', email: 'salman@yusr.com', role: 'SUPER_ADMIN', status: 'ACTIVE', lastActivity: '2024-05-20T11:00:00Z' },
];

export const initialSubscriptions: Subscription[] = [
  { id: 'SUB1', schoolId: 'S1', plan: 'Enterprise', status: 'ACTIVE', startDate: '2023-09-01', endDate: '2024-09-01', remainingDays: 104 },
  { id: 'SUB2', schoolId: 'S2', plan: 'Pro', status: 'EXPIRING_SOON', startDate: '2023-09-15', endDate: '2024-06-15', remainingDays: 26 },
  { id: 'SUB3', schoolId: 'S3', plan: 'Basic', status: 'SUSPENDED', startDate: '2023-11-20', endDate: '2024-11-20', remainingDays: 184 },
  { id: 'SUB4', schoolId: 'S4', plan: 'Enterprise', status: 'ACTIVE', startDate: '2023-09-01', endDate: '2024-09-01', remainingDays: 104 },
];

export const initialActivities: Activity[] = [
  { id: 'ACT1', type: 'ASSESSMENT_COMPLETED', description: 'تم إكمال التقييم الشامل لمدارس الرياض النموذجية', timestamp: '2024-05-18T10:00:00Z', actor: 'نورة السبيعي' },
  { id: 'ACT2', type: 'NEW_SCHOOL', description: 'تمت إضافة مدارس المعرفة الأهلية للمنصة', timestamp: '2024-05-15T14:30:00Z', actor: 'سلمان الشهري' },
  { id: 'ACT3', type: 'SUBSCRIPTION_RENEWED', description: 'تم تجديد اشتراك مدارس المستقبل الأهلية', timestamp: '2024-05-12T09:15:00Z', actor: 'سلمان الشهري' },
];

export const initialAlerts: Alert[] = [
  { id: 'AL1', severity: 'WARNING', message: 'اشتراك ينتهي خلال 26 يوماً', schoolName: 'مدارس النخبة الدولية' },
  { id: 'AL2', severity: 'DANGER', message: 'درجة جودة منخفضة (تتطلب تدخل فوري)', schoolName: 'مدارس الأجيال' },
];

export const initialGaps: Gap[] = [
  { id: 'G1', schoolId: 'S2', domainId: 'D2', indicatorCode: '2.1.3', description: 'غياب التغذية الراجعة الفورية للطلاب', severity: 'MEDIUM', status: 'OPEN', createdAt: '2024-04-22' },
  { id: 'G2', schoolId: 'S3', domainId: 'D1', indicatorCode: '1.2.1', description: 'عدم تفعيل نظام الحوكمة الإلكترونية', severity: 'HIGH', status: 'OPEN', createdAt: '2024-01-15' },
];

export const initialPlans: ImprovementPlan[] = [
  { id: 'P1', schoolId: 'S2', gapId: 'G1', status: 'ON_TRACK', progress: 40, assignee: 'فاطمة الغامدي', deadline: '2024-06-30', updatedAt: '2024-05-10' },
];