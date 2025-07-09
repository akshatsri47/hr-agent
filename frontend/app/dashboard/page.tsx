'use client'

import React, { useState, useEffect, useContext } from 'react'
import { Users } from 'lucide-react'
import { AuthContext } from '@/context/AuthContext'
import JobsGrid from '@/components/ui/dashboard/Jobsgrid'
import UploadResume from '@/components/ui/dashboard/UploadResume'
import ResumeResults from '@/components/ui/dashboard/ResumeResult'

const API_BASE = 'http://localhost:8000'

interface Resume {
  resumeId:        string
  name:            string
  email:           string
  filename:        string
  score:           number
  feedback?:       string
  // ← new:
  interviewDone?:  boolean
  sessionId?:      string
}


interface Job {
  jobId: string
  description: string
  createdAt: string
  scoredResumes: Resume[]
}

type AppState = 'jobs' | 'upload' | 'results'

const HRInterviewApp = () => {
  const { user, ready } = useContext(AuthContext)
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [currentState, setCurrentState] = useState<AppState>('jobs')
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [loading, setLoading] = useState(true)

  // Fetch jobs from API
  const fetchJobs = async () => {
    if (!user) return

    try {
      console.log('🔄 fetchJobs start')
      setLoading(true)
      const response = await fetch(`${API_BASE}/jobs`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch jobs')
      const data = await response.json()
      console.log('✅ fetchJobs got data', data)
      setJobs(data)
    } catch (error) {
      console.error('❌ fetchJobs error', error)
      setJobs([])
    } finally {
      console.log('🏁 fetchJobs done, clearing loading')
      setLoading(false)
    }
  }

  // Create new job with resumes
  const createJob = async (description: string, files: File[]) => {
    if (!user) return

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('description', description)
      files.forEach(file => formData.append('files', file))

      const response = await fetch(`${API_BASE}/jobs`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!response.ok) throw new Error('Failed to create job')

      const newJob = await response.json()
      
      // Set the new job as selected and show processing state
      setSelectedJob(newJob)
      setCurrentState('results')
      setIsProcessing(true)
      
      // Fetch updated jobs list
      await fetchJobs()
      
      // Simulate processing time and then stop processing indicator
      setTimeout(() => {
        setIsProcessing(false)
      }, 3000)
      
      return newJob
    } catch (error) {
      console.error('Error creating job:', error)
      alert('Error creating job. Please try again.')
      setCurrentState('jobs')
    } finally {
      setIsUploading(false)
    }
  }

  // Update existing job (description and/or add more resumes)
  const updateJob = async (jobId: string, description: string, files: File[]) => {
    if (!user || !selectedJob) return

    try {
      setIsUploading(true)
      const formData = new FormData()
      
      // Only append description if it's different from current job description
      if (description !== selectedJob.description) {
        formData.append('description', description)
      }
      
      // Add files if any
      if (files.length > 0) {
        files.forEach(file => formData.append('files', file))
      }

      const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
        method: 'PATCH',
        credentials: 'include',
        body: formData,
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to update job')
      }

      const updateResult = await response.json()
      console.log('✅ Job updated successfully', updateResult)

      setIsProcessing(true)
      setCurrentState('results')
      
      // Fetch updated jobs list to get the latest data
      await fetchJobs()
      
      // Simulate processing time
      setTimeout(() => {
        setIsProcessing(false)
      }, 3000)
      
      return updateResult
    } catch (error) {
      console.error('Error updating job:', error)
      if (error && typeof error === 'object' && 'message' in error) {
        alert(`Error updating job: ${(error as { message: string }).message}`)
      } else {
        alert('Error updating job.')
      }
    } finally {
      setIsUploading(false)
    }
  }

  // Handle upload submission - decides whether to create or update
  const handleUploadSubmit = async (description: string, files: File[]) => {
    if (selectedJob) {
      // Update existing job
      await updateJob(selectedJob.jobId, description, files)
    } else {
      // Create new job
      await createJob(description, files)
    }
  }

  // Navigation handlers
  const handleJobSelect = (job: Job) => {
    setSelectedJob(job)
    setCurrentState('results')
  }

  const handleNewJobClick = () => {
    setSelectedJob(null)
    setCurrentState('upload')
  }

  const handleBackToJobs = () => {
    setSelectedJob(null)
    setCurrentState('jobs')
    setIsProcessing(false)
  }

  const handleAddMoreResumes = () => {
    setCurrentState('upload')
  }

  useEffect(() => {
    if (ready && user) {
      fetchJobs()
    } else if (ready && !user) {
      setLoading(false)
    }
  }, [ready, user])

  // Update selected job when jobs list changes
  useEffect(() => {
    if (selectedJob && jobs.length > 0) {
      const updatedJob = jobs.find(j => j.jobId === selectedJob.jobId)
      if (updatedJob) {
        setSelectedJob(updatedJob)
      }
    }
  }, [jobs, selectedJob])

  // Loading state
  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Authentication required
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center max-w-md">
          <Users className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please log in to access the HR Interview AI portal.</p>
          <button
            onClick={() => (window.location.href = '/login')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  // Render appropriate component based on current state
  switch (currentState) {
    case 'jobs':
      return (
        <JobsGrid
          jobs={jobs}
          user={user}
          loading={loading}
          onJobSelect={handleJobSelect}
          onNewJobClick={handleNewJobClick}
        />
      )
    
    case 'upload':
      return (
        <UploadResume
          user={user}
          selectedJob={selectedJob}
          isUploading={isUploading}
          onBack={handleBackToJobs}
          onSubmit={handleUploadSubmit}
        />
      )
    
    case 'results':
      if (!selectedJob) {
        // Fallback to jobs if no job is selected
        setCurrentState('jobs')
        return null
      }
      
      return (
        <ResumeResults
          user={user}
          job={selectedJob}
          isProcessing={isProcessing}
          onBack={handleBackToJobs}
          onAddMoreResumes={handleAddMoreResumes}
        />
      )
    
    default:
      return null
  }
}

export default HRInterviewApp