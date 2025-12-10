"use client"

import { CheckCircle, AlertCircle } from "lucide-react"
import { useState } from "react"

export function ResultsGrid({ results }: any) {
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No results yet. Start analysis to see results here.</p>
      </div>
    )
  }

  // File → Blob URL 생성 함수
  const getBlobURL = (file: File) => URL.createObjectURL(file)

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex gap-4 justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Analysis Results</h2>
        <select className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-sm">
          <option>All</option>
          <option>PASS</option>
          <option>FAIL</option>
        </select>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((result: any) => (
          <div
            key={result.id}
            className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden hover:border-slate-600 transition-all hover:shadow-lg hover:shadow-slate-900/50"
          >
            {/* Thumbnail */}
            <div
              className="aspect-square bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center relative overflow-hidden cursor-pointer group"
              onClick={() => result.file && setSelectedImageFile(result.file)}
            >
              {result.file ? (
                <>
                  <img
                    src={getBlobURL(result.file)}
                    alt={result.name}
                    className="w-full h-full object-cover"
                    onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
                    onError={() => console.error("이미지 로드 실패:", result.name)}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                    <p className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      클릭하여 확대
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center z-10">
                  <p className="text-xs text-slate-500">이미지 없음</p>
                </div>
              )}
            </div>

            {/* Info Area */}
            <div className="p-4 space-y-3">
              <p className="text-sm font-medium text-slate-300 truncate">{result.name}</p>

              <div className="flex items-center gap-2">
                {result.status === "PASS" ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm font-semibold text-emerald-400">PASS</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-sm font-semibold text-red-400">FAIL</span>
                  </>
                )}
              </div>

              {result.reason && (
                <p className="text-xs text-slate-400 bg-slate-900/50 px-2 py-1 rounded">
                  {result.reason}
                </p>
              )}

              {/* 상세 정보 */}
              {result.details && (
                <div className="space-y-1 pt-2 border-t border-slate-700">
                  {result.details.ocr_status && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">OCR:</span>
                      <span
                        className={`font-medium ${
                          result.details.ocr_status === "Pass"
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {result.details.ocr_status} ({result.details.ocr_lang || "N/A"})
                      </span>
                    </div>
                  )}
                  {result.details.yolo_status && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">YOLO:</span>
                      <span
                        className={`font-medium ${
                          result.details.yolo_status === "Pass"
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {result.details.yolo_status}
                      </span>
                    </div>
                  )}
                  {result.details.cnn_status && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">CNN:</span>
                      <span
                        className={`font-medium ${
                          result.details.cnn_status === "Pass"
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {result.details.cnn_status}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                <span className="text-xs text-slate-500">Confidence</span>
                <span className="text-sm font-semibold text-cyan-400">
                  {result.confidence}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Image Modal */}
      {selectedImageFile && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImageFile(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={getBlobURL(selectedImageFile)}
              alt="확대 이미지"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
              onClick={(e) => e.stopPropagation()}
            />

            <button
              onClick={() => setSelectedImageFile(null)}
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

