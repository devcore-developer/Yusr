import { Domain, Axis, Indicator } from '@/types';

export const domains: Domain[] = [
  { id: 'D1', name: 'الإدارة المدرسية', description: 'إدارة المدرسة والقيادة التربوية' },
  { id: 'D2', name: 'التعليم والتعلم', description: 'ممارسات التدريس والتعلم' },
  { id: 'D3', name: 'نواتج التعلم', description: 'تحصيل الطلاب ومهاراتهم' },
  { id: 'D4', name: 'البيئة المدرسية', description: 'البيئة الفيزيائية والنفسية' },
];

export const axes: Axis[] = [
  { id: 'A1', domainId: 'D1', name: 'القيادة التربوية' },
  { id: 'A2', domainId: 'D1', name: 'الإدارة والتخطيط' },
  { id: 'A3', domainId: 'D2', name: 'تصميم التدريس' },
  { id: 'A4', domainId: 'D2', name: 'تنفيذ التدريس' },
  { id: 'A5', domainId: 'D3', name: 'التحصيل الأكاديمي' },
  { id: 'A6', domainId: 'D3', name: 'المهارات الحياتية' },
  { id: 'A7', domainId: 'D4', name: 'السلامة والأمن' },
  { id: 'A8', domainId: 'D4', name: 'البيئة المحفزة' },
];

export const indicators: Indicator[] = [
  { id: 'I1', axisId: 'A1', code: '1.1.1', description: 'توفير رؤية ورسالة واضحة للمدرسة', targetStatus: 'محقق', guidePage: 12 },
  { id: 'I2', axisId: 'A1', code: '1.1.2', description: 'تطوير خطة سنوية لتحسين الأداء', targetStatus: 'محقق جزئياً', guidePage: 15 },
  { id: 'I3', axisId: 'A2', code: '1.2.1', description: 'تفعيل نظام الحوكمة الإلكترونية', targetStatus: 'غير محقق', guidePage: 22 },
  // ... (Truncated for brevity, 50 items total in actual dataset)
];

export const domainScores = [
  { domainId: 'D1', score: 88, label: 'الإدارة المدرسية' },
  { domainId: 'D2', score: 76, label: 'التعليم والتعلم' },
  { domainId: 'D3', score: 82, label: 'نواتج التعلم' },
  { domainId: 'D4', score: 91, label: 'البيئة المدرسية' },
];