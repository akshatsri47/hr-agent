'use client'

import React, { useState } from 'react'
import {
  Users,
  ArrowLeft,
  Search,
  Download,
  Eye,
  Mail,
  Star,
  FileText,
  Calendar,
  Send,
  CheckSquare,
  Square,
  Loader2
} from 'lucide-react'
import Link from 'next/link'

interface Resume {
  name: string
  email: string
  filename: string
  score: number
  feedback?: string
  resumeId: string
  interviewDone?: boolean
  sessionId?: string
}

interface Job {
  jobId: string
  description: string
  createdAt: string
  scoredResumes: Resume[]
}

interface ResumeResultsProps {
  user: { name: string }
  job: Job
  isProcessing: boolean
  onBack: () => void
  onAddMoreResumes: () => void
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

const ResumeResults: React.FC<ResumeResultsProps> = ({
  user,
  job,
  isProcessing,
  onBack,
  onAddMoreResumes
}) => {
  type SortOption = 'score' | 'name'
  type ScoreFilter = 'all' | 'high' | 'medium' | 'low';
  // Search, filter, sort, selection
  const [searchTerm, setSearchTerm] = useState('')
  const [scoreFilter, setScoreFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [sortBy, setSortBy] = useState<SortOption>('score')
  const [selectedResumes, setSelectedResumes] = useState<Set<string>>(new Set())

  // NEW: scheduling state
  const [scheduleStart, setScheduleStart] = useState<string>('')
  const [scheduleEnd, setScheduleEnd] = useState<string>('')

  // Sending emails state
  const [isSending, setIsSending] = useState(false)
  const [emailResults, setEmailResults] = useState<{
    invited: number
    failed: number
    errors: string[]
  } | null>(null)

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-100'
    if (score >= 6) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 8) return 'Excellent'
    if (score >= 6) return 'Good'
    return 'Needs Review'
  }

  const filteredAndSortedResumes = job.scoredResumes
    .filter(resume => {
      const matchesSearch =
        resume.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        resume.email.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesFilter =
        scoreFilter === 'all' ||
        (scoreFilter === 'high' && resume.score >= 8) ||
        (scoreFilter === 'medium' && resume.score >= 6 && resume.score < 8) ||
        (scoreFilter === 'low' && resume.score < 6)

      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      if (sortBy === 'score') {
        return b.score - a.score
      }
      return a.name.localeCompare(b.name)
    })

  const averageScore =
    job.scoredResumes.length > 0
      ? job.scoredResumes.reduce((sum, r) => sum + r.score, 0) / job.scoredResumes.length
      : 0

  const scoreDistribution = {
    high: job.scoredResumes.filter(r => r.score >= 8).length,
    medium: job.scoredResumes.filter(r => r.score >= 6 && r.score < 8).length,
    low: job.scoredResumes.filter(r => r.score < 6).length
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })

  const handleResumeSelect = (resumeId: string) => {
    const newSelected = new Set(selectedResumes)
    if (newSelected.has(resumeId)) newSelected.delete(resumeId)
    else newSelected.add(resumeId)
    setSelectedResumes(newSelected)
  }

  const handleSelectAll = () => {
    const filteredIds = new Set(filteredAndSortedResumes.map(r => r.resumeId))
    const allSelected = filteredAndSortedResumes.every(r =>
      selectedResumes.has(r.resumeId)
    )
    const newSelected = new Set(selectedResumes)
    if (allSelected) {
      filteredIds.forEach(id => newSelected.delete(id))
    } else {
      filteredIds.forEach(id => newSelected.add(id))
    }
    setSelectedResumes(newSelected)
  }

  const isAllFilteredSelected =
    filteredAndSortedResumes.length > 0 &&
    filteredAndSortedResumes.every(r => selectedResumes.has(r.resumeId))

  // NEW: schedule + send invites
  const handleScheduleAndSend = async () => {
    if (selectedResumes.size === 0) {
      alert('Please select at least one resume to schedule.')
      return
    }
    if (!scheduleStart || !scheduleEnd) {
      alert('Please pick both a start and end time.')
      return
    }
    const startISO = new Date(scheduleStart).toISOString()
    const endISO = new Date(scheduleEnd).toISOString()
    if (startISO >= endISO) {
      alert('Start time must be before end time.')
      return
    }

    setIsSending(true)
    setEmailResults(null)

    try {
      // 1️⃣ Schedule the interviews
      const schedResp = await fetch(`${API_BASE}/schedule-interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          job_id: job.jobId,
          resume_ids: Array.from(selectedResumes),
          start_time: startISO,
          end_time: endISO
        })
      })
      if (!schedResp.ok) {
        const err = await schedResp.text()
        throw new Error(`Scheduling failed: ${err}`)
      }

      // 2️⃣ Send the invites
      const inviteResp = await fetch(`${API_BASE}/send-invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          job_id: job.jobId,
          resume_ids: Array.from(selectedResumes)
        })
      })
      if (!inviteResp.ok) {
        throw new Error('Failed to send invites')
      }
      const result = await inviteResp.json()
      setEmailResults(result)

      // clear selections
      setSelectedResumes(new Set())
      setScheduleStart('')
      setScheduleEnd('')
    } catch (error: unknown) {
      console.error(error);
      
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('Error scheduling or sending invites.');
      }
    } finally {
      setIsSending(false);
    }
    
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">HR Interview AI</h1>
                  <p className="text-sm text-gray-500">Welcome, {user.name}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={onAddMoreResumes}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>Add More Resumes</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Email Results */}
        {emailResults && (
          <div className="mb-6 p-4 border rounded-lg bg-blue-50 border-blue-200">
            <div className="flex items-center space-x-2 mb-2">
              <Send className="w-5 h-5 text-blue-600" />
              <h3 className="font-medium text-blue-900">Email Invitation Results</h3>
            </div>
            <div className="text-sm text-blue-800">
              <p>✅ Successfully sent: {emailResults.invited} invitations</p>
              {emailResults.failed > 0 && (
                <p>❌ Failed to send: {emailResults.failed} invitations</p>
              )}
              {emailResults.errors.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Errors:</p>
                  <ul className="list-disc list-inside">
                    {emailResults.errors.map((err, i) => (
                      <li key={i} className="text-red-600">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scheduling Controls */}
        {selectedResumes.size > 0 && (
          <div className="mb-6 bg-white p-4 rounded-lg shadow-sm flex flex-wrap items-end space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start time</label>
              <input
                type="datetime-local"
                value={scheduleStart}
                onChange={e => setScheduleStart(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End time</label>
              <input
                type="datetime-local"
                value={scheduleEnd}
                onChange={e => setScheduleEnd(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
              />
            </div>
            <button
              onClick={handleScheduleAndSend}
              disabled={isSending}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Scheduling & Sending…</span>
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  <span>Schedule & Send Invites ({selectedResumes.size})</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Job Info & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Job Description</h2>
              <div className="flex items-center space-x-1 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(job.createdAt)}</span>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700 text-sm line-clamp-4">{job.description}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Resumes</span>
                <span className="font-medium">{job.scoredResumes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Average Score</span>
                <div className="flex items-center space-x-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="font-medium">{averageScore.toFixed(1)}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Selected</span>
                <span className="font-medium text-green-600">{selectedResumes.size}</span>
              </div>
              {isProcessing && (
                <div className="flex items-center space-x-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm">Processing...</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Distribution</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-600">Excellent (8+)</span>
                <span className="font-medium">{scoreDistribution.high}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-yellow-600">Good (6-8)</span>
                <span className="font-medium">{scoreDistribution.medium}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-red-600">Needs Review (&lt;6)</span>
                <span className="font-medium">{scoreDistribution.low}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={scoreFilter}
                onChange={e => setScoreFilter(e.target.value as ScoreFilter )}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Scores</option>
                <option value="high">Excellent (8+)</option>
                <option value="medium">Good (6-8)</option>
                <option value="low">Needs Review (&lt;6)</option>
              </select>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="score">Score</option>
                  <option value="name">Name</option>
                </select>
              </div>
              {filteredAndSortedResumes.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  {isAllFilteredSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span>Select All Filtered</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleSelectAll}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {isAllFilteredSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <span>Select</span>
                    </div>
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Candidate
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAndSortedResumes.map((resume, idx) => (
                  <tr key={resume.resumeId || idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleResumeSelect(resume.resumeId)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {selectedResumes.has(resume.resumeId) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{resume.name}</div>
                        <div className="text-sm text-gray-500 flex items-center space-x-1">
                          <Mail className="w-3 h-3" />
                          <span>{resume.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(
                            resume.score
                          )}`}
                        >
                          {resume.score.toFixed(1)}
                        </div>
                        <Star className="w-4 h-4 text-yellow-500" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getScoreColor(
                          resume.score
                        )}`}
                      >
                        {getScoreLabel(resume.score)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500">{resume.filename}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          className="text-blue-600 hover:text-blue-800 p-1 rounded"
                          title="View Resume"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="text-green-600 hover:text-green-800 p-1 rounded"
                          title="Download Resume"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          className="text-gray-600 hover:text-gray-800 p-1 rounded"
                          title="Contact Candidate"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {resume.interviewDone && resume.sessionId ? (
                        <Link
                          href={`/result/session/${resume.sessionId}`}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                        >
                          View Interview
                        </Link>
                      ) : (
                        <span className="bg-gray-200 text-gray-600 px-3 py-1 rounded text-sm">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAndSortedResumes.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No resumes found</h3>
              <p className="text-gray-500">
                {searchTerm || scoreFilter !== 'all'
                  ? 'No resumes match your current filters.'
                  : 'No resumes have been uploaded yet.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResumeResults
