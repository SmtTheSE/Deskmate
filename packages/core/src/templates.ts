import type { Department, TemplateId } from './types.ts';

/**
 * Ready-made starting points so an organization does not begin from a blank page.
 * Everything here can be renamed or removed in the setup wizard or in Settings.
 */

export interface Template {
  id: TemplateId;
  title: string;
  blurb: string;
  departments: Department[];
  starterDocs: { title: string; text: string }[];
}

const dep = (id: string, name: string, description: string, keywords: string[]): Department => ({ id, name, description, keywords, mode: 'approval' });

export const TEMPLATES: Template[] = [
  {
    id: 'school',
    title: 'School',
    blurb: 'For primary and secondary schools. Front office, IT, attendance, and more.',
    departments: [
      dep('front-office', 'Front office', 'General questions, visits, letters and forms.', ['office', 'form', 'letter', 'visit', 'pickup', 'uniform', 'trip', 'permission']),
      dep('attendance', 'Attendance', 'Absences, late arrivals, and early pickups.', ['absent', 'absence', 'sick', 'late', 'attendance', 'appointment', 'holiday', 'leave early']),
      dep('it', 'IT help', 'Passwords, laptops, Wi-Fi, and school apps.', ['password', 'login', 'log in', 'laptop', 'chromebook', 'wifi', 'wi-fi', 'email', 'printer', 'projector', 'account', 'app']),
      dep('teaching', 'Teaching and learning', 'Homework, grades, timetables, and exams.', ['homework', 'grade', 'grades', 'exam', 'test', 'teacher', 'class', 'timetable', 'report card', 'assignment']),
      dep('facilities', 'Facilities', 'Repairs, heating, cleaning, and lost property.', ['broken', 'repair', 'heating', 'leak', 'toilet', 'door', 'lost property', 'cleaning', 'light']),
    ],
    starterDocs: [
      {
        title: 'Sample: IT help guide',
        text: `Resetting your school password
Students and staff can reset their password at any time from the sign-in page by choosing "Forgot password". A reset link is sent to your school email address. If you cannot get into your email, visit the IT desk in the library between 8:00 and 16:00, bring your school ID card, and we will reset it for you.

Wi-Fi
Connect to the network called "School-WiFi" and sign in with your normal school username and password. Personal phones should use "School-Guest", which does not need a password but limits some websites.

Broken laptops and Chromebooks
If a school laptop or Chromebook is damaged or not turning on, bring it to the IT desk. Please do not try to repair it yourself. A loan device is usually available the same day.

Projectors and classroom screens
Teachers can report a faulty projector or classroom screen through this help desk. Include the room number. Urgent issues during a lesson can be reported by phoning extension 210.`,
      },
      {
        title: 'Sample: Attendance policy',
        text: `Reporting an absence
If your child is sick, unwell, or absent for any other reason, parents and carers should report the absence before 9:00 on each day the student is away. Please include the student's name, class, and the reason for the absence. You can reply to this help desk, phone the attendance line, or use the school app.

Medical appointments
Where possible, please book appointments outside school hours. If your child must leave early, send a note or message the office in advance and collect them from reception.

Term-time holidays
Holidays during term time are not normally authorised. Requests must be made in writing to the headteacher at least four weeks in advance.`,
      },
    ],
  },
  {
    id: 'university',
    title: 'University or college',
    blurb: 'For higher education. Admissions, registrar, student services, IT, and more.',
    departments: [
      dep('admissions', 'Admissions', 'Applications, offers, and entry requirements.', ['apply', 'application', 'admission', 'offer', 'entry', 'requirements', 'deadline', 'transcript']),
      dep('registrar', 'Registrar', 'Enrolment, course registration, transcripts, and records.', ['enrol', 'enroll', 'registration', 'register', 'transcript', 'record', 'credit', 'withdraw', 'course']),
      dep('finance', 'Fees and finance', 'Tuition fees, payments, scholarships, and refunds.', ['fee', 'fees', 'tuition', 'payment', 'pay', 'refund', 'scholarship', 'loan', 'invoice']),
      dep('it', 'IT services', 'Accounts, Wi-Fi, learning platform, and software.', ['password', 'login', 'log in', 'wifi', 'wi-fi', 'email', 'canvas', 'moodle', 'software', 'account', 'vpn']),
      dep('student-services', 'Student services', 'Housing, wellbeing, disability support, and careers.', ['housing', 'accommodation', 'wellbeing', 'counselling', 'disability', 'support', 'career', 'visa']),
    ],
    starterDocs: [
      {
        title: 'Sample: Registration FAQ',
        text: `Course registration
Course registration for the spring semester opens on the date shown in the academic calendar. Register through the student portal under "My courses". If a course is full, you can join the waitlist and you will be notified by email if a place opens.

Adding or dropping a course
You can add or drop courses without penalty during the first two weeks of the semester. After that, withdrawing from a course requires your advisor's approval and appears on your transcript as "W".

Official transcripts
Order official transcripts from the student portal under "Records". Electronic transcripts are usually sent within two working days.`,
      },
    ],
  },
  {
    id: 'company',
    title: 'Company or nonprofit',
    blurb: 'For workplaces. IT, HR, facilities, and finance.',
    departments: [
      dep('it', 'IT help', 'Accounts, devices, software, and access.', ['password', 'login', 'log in', 'laptop', 'vpn', 'email', 'software', 'access', 'account', 'printer', 'phone']),
      dep('hr', 'People and HR', 'Leave, payroll questions, benefits, and onboarding.', ['leave', 'holiday', 'vacation', 'sick', 'payroll', 'payslip', 'benefits', 'onboarding', 'contract', 'parental']),
      dep('facilities', 'Facilities', 'Office access, repairs, desks, and deliveries.', ['badge', 'access card', 'desk', 'repair', 'broken', 'heating', 'parking', 'delivery', 'room']),
      dep('finance', 'Finance', 'Expenses, invoices, and purchasing.', ['expense', 'expenses', 'invoice', 'reimburse', 'purchase', 'budget', 'receipt', 'card']),
    ],
    starterDocs: [
      {
        title: 'Sample: Expenses policy',
        text: `Submitting expenses
Submit expenses within 30 days of purchase using the expenses tool. Attach a photo of each receipt. Expenses are reimbursed in the next payroll run after approval by your manager.

What can be claimed
Travel for work, client meals up to the agreed limit, and pre-approved equipment can be claimed. Personal items, fines, and alcohol cannot be claimed.`,
      },
    ],
  },
  {
    id: 'blank',
    title: 'Start from scratch',
    blurb: 'One general queue. Add your own departments.',
    departments: [dep('general', 'General', 'Everything else.', [])],
    starterDocs: [],
  },
];

export function getTemplate(id: TemplateId): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[TEMPLATES.length - 1]!;
}
