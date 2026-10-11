import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      schoolId?: string
      branchId?: string
    } & DefaultSession["user"]
  }

  interface User {
    role: string
    schoolId?: string
    branchId?: string
  }
}