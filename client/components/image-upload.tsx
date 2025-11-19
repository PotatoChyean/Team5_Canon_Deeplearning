"use client"

import type React from "react"
import { useState } from "react"
import { Upload, File as FileIcon } from "lucide-react"

// 1. 상태 타입 정의 (Preview URL과 원본 File 객체를 저장)
type UploadedFileItem = {
    file: File;
    previewUrl: string;
    name: string;
};

export function ImageUpload({ setIsProcessing, setResults }: any) {
    // 2. useState 타입을 변경된 커스텀 객체 배열로 설정
    const [files, setFiles] = useState<UploadedFileItem[]>([])
    const [isDragging, setIsDragging] = useState(false)

    // 헬퍼 함수: 원본 File 객체를 UploadedFileItem 타입으로 변환
    const mapFilesToUploadedItems = (fileList: File[]): UploadedFileItem[] => {
        return fileList.map(file => ({
            file: file,
            previewUrl: URL.createObjectURL(file),
            name: file.name
        }));
    };
    
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    // 3. handleDrop 수정: 원본 File 객체를 UploadedFileItem으로 변환
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const droppedFiles = Array.from(e.dataTransfer.files) as File[]
        const filesWithPreview = mapFilesToUploadedItems(droppedFiles);
        setFiles((prev) => [...prev, ...filesWithPreview])
    }

    // 4. handleFileSelect 수정: 원본 File 객체를 UploadedFileItem으로 변환
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files) as File[]
            const filesWithPreview = mapFilesToUploadedItems(selectedFiles)
            setFiles((prev) => [...prev, ...filesWithPreview])
        }
    }

  const handleStartAnalysis = async () => {
    if (files.length === 0) return

    setIsProcessing(true)

    try {
      const formData = new FormData()

      // FormData에 원본 File 객체(item.file)만 전달하는 로직 (타입스크립트 오류 방지)
      files.forEach((item) => {
        formData.append("files", item.file as Blob)
      })

      // FastAPI 백엔드 호출 (포트 5000)
      const response = await fetch("http://localhost:5000/api/analyze-batch", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`API 오류: ${response.statusText}`)
      }

      const data = await response.json()

      // 🚨 [핵심 수정]: API 응답과 원본 files 상태를 합쳐 previewUrl을 추가합니다.
      const results = data.results.map((result: any, index: number) => {
        // 원본 files 상태에서 현재 결과의 파일 이름과 일치하는 항목을 찾습니다.
        const fileItem = files.find(item => item.name === result.filename);

        return {
          id: result.id || index,
          name: result.filename,
          status: result.status,
          reason: result.reason || null,
          confidence: result.confidence || 0,
          timestamp: result.timestamp,
          details: result.details || {},

          // 🖼️ Preview URL 추가: 이 정보가 ResultsGrid로 전달됩니다.
          previewUrl: fileItem ? fileItem.previewUrl : null,
        };
      });
      console.log("Final Processed Results:", results);
      setResults(results)

    } catch (error) {
      console.error("분석 중 오류 발생:", error)
      alert("분석 중 오류가 발생했습니다. 백엔드 서버가 실행 중인지 확인하세요.")
    } finally {
      setIsProcessing(false)
    }
  }

    const handleRemoveFile = (index: number) => {
        // 6. Preview 메모리 해제: URL.revokeObjectURL 호출
        const fileToRemove = files[index];
        if (fileToRemove && fileToRemove.previewUrl) {
            URL.revokeObjectURL(fileToRemove.previewUrl);
        }
        setFiles((prev) => prev.filter((_, i) => i !== index))
    }

    // 7. Preview 이미지 렌더링
    return (
        <div className="space-y-6 max-w-4xl">
            {/* Drag and Drop Zone (변경 없음) */}
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
                    className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors cursor-pointer"
                >
                    Select Folder
                    <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </label>
            </div>

            {/* File List (Preview 표시) */}
            {files.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <h4 className="text-sm font-semibold text-white mb-4">Selected Files ({files.length})</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {files.map((item, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700"
                            >
                                <div className="flex items-center gap-3">
                                    {/* 🚨 수정: Preview 이미지 표시 */}
                                    {item.previewUrl ? (
                                        <img 
                                            src={item.previewUrl} 
                                            alt={item.name} 
                                            className="w-8 h-8 object-cover rounded" 
                                        />
                                    ) : (
                                        <FileIcon className="w-4 h-4 text-blue-400" />
                                    )}
                                    <span className="text-sm text-slate-300">{item.name}</span>
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