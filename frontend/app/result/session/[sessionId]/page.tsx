// app/dashboard/result/session/[sessionId]/page.tsx
'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Session = {
  average_score?: number
  summary?: string
}

export default function InterviewSummaryPage() {
  const { sessionId } = useParams() as { sessionId: string }
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
const API_BASE = 'http://localhost:8000'
  useEffect(() => {
    if (!sessionId) return
    fetch(`${API_BASE}/session/${sessionId}`, {
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load session')
        return res.json()
      })
      .then(data => {
        setSession(data.session)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setError(err.message)
        setLoading(false)
      })
  }, [sessionId])

  if (loading) return <p className="p-6">Loading…</p>
  if (error || !session)
    return <p className="p-6 text-red-600">Error: {error || 'Not found'}</p>

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Interview Summary</h1>
      <div className="p-6 bg-white rounded shadow">
        <h2 className="text-lg font-medium">Average Score</h2>
        <p className="text-4xl">
          {session.average_score?.toFixed(1) ?? 'N/A'}/10
        </p>
      </div>
      <div className="p-6 bg-white rounded shadow">
        <h2 className="text-lg font-medium">Strengths & Growth Areas</h2>
        <p className="mt-2 whitespace-pre-wrap">
          {session.summary ?? 'No summary available.'}
        </p>
      </div>
      <button
        onClick={() => router.back()}
        className="px-4 py-2 bg-gray-200 rounded"
      >
        ← Back to Transcript
      </button>
    </div>
  )
}
