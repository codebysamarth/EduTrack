// ═══════════════════════════════════════
// Type definitions — mirrors Prisma schema
// ═══════════════════════════════════════

export type RoleName = 'STUDENT' | 'GUIDE' | 'COORDINATOR' | 'HOD' | 'ADMIN'
export type Year = 'FY' | 'SY' | 'TY' | 'FINAL'
export type ProjectStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'REJECTED'
  | 'APPROVED'
  | 'COMPLETED'
  | 'PUBLISHED'
export type FF180Status = 'PENDING' | 'SUBMITTED' | 'APPROVED'

export interface User {
  id: string
  email: string
  name: string
  phone?: string
  isApproved: boolean
  prnNo?: string
  roles: RoleName[]
  studentProfile?: StudentProfile
  facultyProfile?: FacultyProfile
  createdAt: string
}

export interface StudentProfile {
  id: string
  userId: string
  prnNo: string
  enrollmentNo: string
  departmentId: string
  department?: Department
  year: Year
  division: string
}

export interface FacultyProfile {
  id: string
  userId: string
  prnNo: string
  employeeId?: string
  departmentId: string
  department?: Department
  designation: string
}

export interface Department {
  id: string
  name: string
  code: string
}

export interface UserRole {
  id: string
  userId: string
  roleId: string
  departmentId?: string
  year?: Year
  role: { id: string; name: RoleName }
  department?: Department
}

export interface Group {
  id: string
  name: string
  departmentId: string
  department?: Department
  year: Year
  division: string
  guideId?: string
  guide?: User
  coordinatorId?: string
  coordinator?: User
  academicYear: string
  semester: number
  members?: GroupMember[]
  project?: Project
  createdAt: string
}

export interface GroupMember {
  id: string
  groupId: string
  studentId: string
  isLeader: boolean
  student?: User
}

export interface Project {
  id: string
  groupId: string
  group?: Group
  departmentId: string
  department?: Department
  title: string
  abstract?: string
  sdgGoals?: number[]
  domain?: string
  techStack?: string
  githubLink?: string
  videoLink?: string
  driveLink?: string
  researchPaperLink?: string
  patentLink?: string
  ff180Status: FF180Status
  status: ProjectStatus
  isPublished: boolean
  publishedAt?: string
  reviews?: ProjectReview[]
  createdAt: string
  updatedAt: string
}

export interface ProjectReview {
  id: string
  projectId: string
  reviewerId: string
  reviewer?: User
  comment: string
  isApproved: boolean
  rejectionReason?: string
  createdAt: string
}

export interface AuditLog {
  id: string
  userId: string
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface LoginResponse {
  token: string
  user: User
  redirectTo: string
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
