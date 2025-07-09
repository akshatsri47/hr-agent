import React, { useState } from 'react'
import {
  Upload,
  Users,
  ArrowLeft
} from 'lucide-react'

interface Job {
  jobId: string
  description: string
  createdAt: string
  scoredResumes: Array<{
    name: string
    email: string
    filename: string
    score: number
  }>
}

interface UploadResumeProps {
  user: { name: string }
  selectedJob: Job | null
  isUploading: boolean
  onBack: () => void
  onSubmit: (description: string, files: File[]) => Promise<void>
}

const UploadResume: React.FC<UploadResumeProps> = ({
  user,
  selectedJob,
  isUploading,
  onBack,
  onSubmit
}) => {
  const [newJobDescription, setNewJobDescription] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files))
    }
  }

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select at least one resume file')
      return
    }
    
    if (!selectedJob && !newJobDescription.trim()) {
      alert('Please enter a job description')
      return
    }

    const description = selectedJob ? selectedJob.description : newJobDescription
    await onSubmit(description, selectedFiles)
    
    // Reset form
    setNewJobDescription('')
    setSelectedFiles([])
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-100'
    if (score >= 6) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
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
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Job Description Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {selectedJob ? 'Job Description' : 'Create New Job'}
              </h2>
              
              {selectedJob ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedJob.description}</p>
                  </div>
                  
                  {selectedJob.scoredResumes.length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-900 mb-3">Scored Resumes ({selectedJob.scoredResumes.length})</h3>
                      <div className="space-y-2">
                        {selectedJob.scoredResumes.map((resume, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{resume.name}</p>
                              <p className="text-sm text-gray-500">{resume.email}</p>
                              <p className="text-xs text-gray-400">{resume.filename}</p>
                            </div>
                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(resume.score)}`}>
                              {resume.score.toFixed(1)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Description
                  </label>
                  <textarea
                    value={newJobDescription}
                    onChange={(e) => setNewJobDescription(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter the job description, requirements, and qualifications..."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Upload Section */}
          <div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Resume Data</h3>
              <p className="text-sm text-gray-600 mb-6">
                {selectedJob ? 'Add more resumes to this job' : 'Upload PDF resumes to get started'}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Resume Files
                  </label>
                  <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <div className="text-sm text-gray-600 mb-2">
                      Click to upload or drag and drop
                    </div>
                    <div className="text-xs text-gray-500">
                      PDF files only, max 100 resumes
                    </div>
                    <input
                      type="file"
                      multiple
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Selected Files:</p>
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-700 truncate">{file.name}</span>
                        <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-medium text-yellow-800 mb-2">Important Notes:</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Ensure resume files are in PDF format</li>
                    <li>• Maximum 100 resumes per upload</li>
                    <li>• Files will be automatically scored against the job description</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isUploading || selectedFiles.length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>{selectedJob ? 'Add Resumes' : 'Upload & Process'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UploadResume