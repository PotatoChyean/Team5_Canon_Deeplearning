"use client"

import { CheckCircle, AlertCircle, File as FileIcon } from "lucide-react"

export function ResultsGrid({ results }: any) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No results yet. Start analysis to see results here.</p>
      </div>
    )
  }

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((result: any) => (
          <div
            key={result.id}
            className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden hover:border-slate-600 transition-all hover:shadow-lg hover:shadow-slate-900/50"
          >
            {/* Thumbnail */}
            <div className="aspect-square bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_30%,rgba(255,255,255,.1)_50%,transparent_70%)]"></div>
              </div>
              <div className="text-center z-10">
                {result.previewUrl ? (
                  <img src={result.previewUrl} alt={result.name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <FileIcon className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                )}
                <p className="text-xs text-slate-500 z-20 absolute bottom-2 left-1/2 transform -translate-x-1/2">
                  {result.previewUrl ? '' : 'No Preview'}
                </p>
              </div>
            </div>

            {/* Result Info */}
            <div className="p-4 space-y-3">
              <div className="truncate">
                <p className="text-sm font-medium text-slate-300 truncate">{result.name}</p>
              </div>

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

              {result.reason != null && (
                <p className="text-xs text-slate-400 bg-slate-900/50 px-2 py-1 rounded">
                  {/* reason 값이 빈 문자열일 때 "N/A" 표시 */}
                  {result.reason || "N/A (사유 없음)"}
                </p>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                <span className="text-xs text-slate-500">Confidence</span>
                <span className="text-sm font-semibold text-cyan-400">{result.confidence}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function File({ className }: { className: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" />
}
