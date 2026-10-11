"use client"

import React, { createContext, useContext, useState } from 'react'
import { School, Branch, User, Subscription, Activity, Alert, Gap, ImprovementPlan } from '@/types'
import * as mockData from '@/data/mock-data'

interface SuperAdminContextType {
  schools: School[]
  branches: Branch[]
  users: User[]
  subscriptions: Subscription[]
  activities: Activity[]
  alerts: Alert[]
  gaps: Gap[]
  plans: ImprovementPlan[]
  addSchool: (school: School) => void
  updateSchool: (school: School) => void
  deleteSchool: (id: string) => void
  addBranch: (branch: Branch) => void
  updateSubscription: (sub: Subscription) => void
  addUser: (user: User) => void
}

const SuperAdminContext = createContext<SuperAdminContextType | undefined>(undefined)

export function SuperAdminProvider({ children }: { children: React.ReactNode }) {
  const [schools, setSchools] = useState<School[]>(mockData.initialSchools)
  const [branches, setBranches] = useState<Branch[]>(mockData.initialBranches)
  const [users, setUsers] = useState<User[]>(mockData.initialUsers)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(mockData.initialSubscriptions)
  const [activities, setActivities] = useState<Activity[]>(mockData.initialActivities)
  const [alerts] = useState<Alert[]>(mockData.initialAlerts)
  const [gaps] = useState<Gap[]>(mockData.initialGaps)
  const [plans] = useState<ImprovementPlan[]>(mockData.initialPlans)

  const addSchool = (school: School) => setSchools(prev => [school, ...prev])
  const updateSchool = (updatedSchool: School) => 
    setSchools(prev => prev.map(s => s.id === updatedSchool.id ? updatedSchool : s))
  
  const deleteSchool = (id: string) => {
    setSchools(prev => prev.filter(s => s.id !== id))
    setBranches(prev => prev.filter(b => b.schoolId !== id))
  }

  const addBranch = (branch: Branch) => setBranches(prev => [...prev, branch])
  
  const updateSubscription = (updatedSub: Subscription) => 
    setSubscriptions(prev => prev.map(s => s.id === updatedSub.id ? updatedSub : s))

  const addUser = (user: User) => setUsers(prev => [...prev, user])

  return (
    <SuperAdminContext.Provider value={{ 
      schools, branches, users, subscriptions, activities, alerts, gaps, plans,
      addSchool, updateSchool, deleteSchool, addBranch, updateSubscription, addUser
    }}>
      {children}
    </SuperAdminContext.Provider>
  )
}

export function useSuperAdmin() {
  const context = useContext(SuperAdminContext)
  if (context === undefined) {
    throw new Error('useSuperAdmin must be used within a SuperAdminProvider')
  }
  return context
}