import { School, Activity, Alert } from '@/types';

export const mockSchools: School[] = [
  { id: 'S1', name: 'مدارس المستقبل الأهلية', status: 'ACTIVE', branchCount: 4, userCount: 120, assessmentProgress: 80, qualityScore: 92, subscriptionStatus: 'ACTIVE', lastAssessment: '2024-05-10', createdAt: '2023-08-01', description: 'مدارس رائدة', location: 'الرياض', contactPhone: '050', contactEmail: 'a@a', managerId: 'U1' },
  { id: 'S2', name: 'مدارس النخبة الدولية', status: 'ACTIVE', branchCount: 2, userCount: 85, assessmentProgress: 45, qualityScore: 78, subscriptionStatus: 'EXPIRING_SOON', lastAssessment: '2024-04-22', createdAt: '2023-09-15', description: 'تعليم دولي', location: 'جدة', contactPhone: '050', contactEmail: 'a@a', managerId: 'U2' },
  { id: 'S3', name: 'مدارس الأجيال', status: 'SUSPENDED', branchCount: 1, userCount: 40, assessmentProgress: 10, qualityScore: 65, subscriptionStatus: 'SUSPENDED', lastAssessment: '2024-01-15', createdAt: '2023-11-20', description: 'إعداد جيل', location: 'الدمام', contactPhone: '050', contactEmail: 'a@a', managerId: 'U3' },
  { id: 'S4', name: 'مدارس الرياض النموذجية', status: 'ACTIVE', branchCount: 6, userCount: 210, assessmentProgress: 100, qualityScore: 95, subscriptionStatus: 'ACTIVE', lastAssessment: '2024-05-18', createdAt: '2022-09-01', description: 'نموذجية', location: 'الرياض', contactPhone: '050', contactEmail: 'a@a', managerId: 'U4' },
  { id: 'S5', name: 'مدارس المعرفة الأهلية', status: 'PENDING', branchCount: 1, userCount: 15, assessmentProgress: 0, qualityScore: 0, subscriptionStatus: 'EXPIRED', lastAssessment: '-', createdAt: '2024-05-15', description: 'جديدة', location: 'مكة', contactPhone: '050', contactEmail: 'a@a', managerId: 'U5' },
];

export const mockActivities: Activity[] = [
  { id: 'ACT1', type: 'ASSESSMENT_COMPLETED', description: 'تم إكمال التقييم الشامل لمدارس الرياض النموذجية', timestamp: '2024-05-18T10:00:00Z', actor: 'نورة السبيعي' },
  { id: 'ACT2', type: 'NEW_SCHOOL', description: 'تمت إضافة مدارس المعرفة الأهلية للمنصة', timestamp: '2024-05-15T14:30:00Z', actor: 'سلمان الشهري' },
  { id: 'ACT3', type: 'REPORT_GENERATED', description: 'تم توليد تقرير جودة لمدارس المستقبل الأهلية', timestamp: '2024-05-12T09:15:00Z', actor: 'سلمان الشهري' },
];

export const mockAlerts: Alert[] = [
  { id: 'AL1', severity: 'WARNING', message: 'اشتراك ينتهي خلال 7 أيام', schoolName: 'مدارس النخبة الدولية' },
  { id: 'AL2', severity: 'DANGER', message: 'درجة جودة منخفضة (تتطلب تدخل فوري)', schoolName: 'مدارس الأجيال' },
  { id: 'AL3', severity: 'WARNING', message: 'تقييم غير مكتمل منذ 30 يوماً', schoolName: 'مدارس الأجيال' },
];