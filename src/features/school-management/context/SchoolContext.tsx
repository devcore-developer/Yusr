"use client"

import React, { createContext, useContext, useState } from 'react'
import { Branch, User, Gap, ImprovementPlan, Assessment } from '@/types'
import * as mockData from '@/data/mock-school-data'

interface SchoolContextType {
  branches: Branch[]
  users: User[]
  gaps: Gap[]
  plans: ImprovementPlan[]
  assessments: Assessment[]
  addBranch: (branch: Branch) => void
  updateBranch: (branch: Branch) => void
  addUser: (user: User) => void
  updateUser: (user: User) => void
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined)

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>(mockData.initialSchoolBranches)
  const [users, setUsers] = useState<User[]>(mockData.initialSchoolUsers)
  const [gaps] = useState<Gap[]>(mockData.initialSchoolGaps)
  const [plans] = useState<ImprovementPlan[]>(mockData.initialSchoolPlans)
  const [assessments] = useState<Assessment[]>(mockData.initialSchoolAssessments)

  const addBranch = (branch: Branch) => setBranches(prev => [...prev, branch])
  const updateBranch = (updated: Branch) => setBranches(prev => prev.map(b => b.id === updated.id ? updated : b))
  
  const addUser = (user: User) => setUsers(prev => [...prev, user])
  const updateUser = (updated: User) => setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))

  return (
    <SchoolContext.Provider value={{ branches, users, gaps, plans, assessments, addBranch, updateBranch, addUser, updateUser }}>
      {children}
    </SchoolContext.Provider>
  )
}

export function useSchool() {
  const ctx = useContext(SchoolContext)
  if (!ctx) throw new Error('useSchool must be used within SchoolProvider')
  return ctx
}