"use client"

import type React from "react"

import { useState } from "react"
import { Upload, File } from "lucide-react"

export function ImageUpload({ setIsProcessing, setResults }: any) {
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    setFiles((prev) => [...prev, ...droppedFiles])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setFiles((prev) => [...prev, ...selectedFiles])
    }
  }

  const handleStartAnalysis = async () => {
    if (files.length === 0) return

    setIsProcessing(true)

    try {
      const formData = new FormData()
      files.forEach((file) => {
        formData.append("files", file)
      })

      // FastAPI 백엔드 호출
      const response = await fetch("http://localhost:5000/api/analyze-batch", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`API 오류: ${response.statusText}`)
      }

      const data = await response.json()
      const results = data.results.map((result: any, index: number) => ({
        id: result.id || index,
        name: result.filename,
        status: result.status,
        reason: result.reason || null,
        confidence: result.confidence || 0,
        timestamp: result.timestamp,
        details: result.details || {}, // 상세 정보 포함
      }))

      setResults(results)
    } catch (error) {
      console.error("분석 중 오류 발생:", error)
      alert("분석 중 오류가 발생했습니다. 백엔드 서버가 실행 중인지 확인하세요.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${isDragging ? "border-blue-500 bg-blue-500/10" : "border-slate-600 bg-slate-800/30 hover:border-slate-500"
          }`}
      >
        <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Upload Image Folder</h3>
        <p className="text-slate-400 mb-6">Drag and drop your images here or click below to select files</p>
        <label
          // label에 직접 버튼 스타일을 적용합니다.
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors cursor-pointer"
        >
          Select Folder
          {/* <input>은 여전히 숨겨진 채로 <label>의 자식으로 유지됩니다. */}
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h4 className="text-sm font-semibold text-white mb-4">Selected Files ({files.length})</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700"
              >
                <div className="flex items-center gap-3">
                  <File className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-slate-300">{file.name}</span>
                </div>
                <button
                  onClick={() => handleRemoveFile(index)}
                  className="text-slate-400 hover:text-red-400 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start Analysis Button */}
      {files.length > 0 && (
        <button
          onClick={handleStartAnalysis}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-500/30"
        >
          Start Analysis
        </button>
      )}
    </div>
  )
}
