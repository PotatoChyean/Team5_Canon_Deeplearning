"use client"

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Download, Calendar as CalendarIcon } from "lucide-react"
import { useState, useEffect } from "react"
import { toast } from "@/components/ui/use-toast"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export function SummaryAnalytics({ results }: any) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()

  useEffect(() => {
    // 백엔드에서 통계 데이터 가져오기
    const fetchStatistics = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (startDate) params.append("start_date", format(startDate, "yyyy-MM-dd"))
        if (endDate) params.append("end_date", format(endDate, "yyyy-MM-dd"))

        const response = await fetch(`http://localhost:5000/api/statistics?${params.toString()}`)
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error("통계 조회 오류:", error)
        toast({
          title: "Error",
          description: "Failed to fetch statistics.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchStatistics()
  }, [startDate, endDate])

  const handleDownloadReport = async () => {
    setIsDownloading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append("start_date", format(startDate, "yyyy-MM-dd"))
      if (endDate) params.append("end_date", format(endDate, "yyyy-MM-dd"))

      const response = await fetch(`http://localhost:5000/api/report?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Failed to download report")
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      
      const contentDisposition = response.headers.get("content-disposition")
      let filename = "analysis_report.csv";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/)
        if (filenameMatch && filenameMatch.length > 1) {
          filename = filenameMatch[1];
        }
      }

      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: "Report downloaded successfully.",
      })

    } catch (error) {
      console.error("리포트 다운로드 오류:", error)
      toast({
        title: "Error",
        description: "Failed to download report.",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const passCount = stats?.pass ?? 0
  const failCount = stats?.fail ?? 0
  const totalCount = stats?.total ?? 0
  const passRate = stats?.pass_rate ?? 0

  const pieData = [
    { name: "Pass", value: passCount, fill: "#10b981" },
    { name: "Fail", value: failCount, fill: "#ef4444" },
  ]

  const barData = stats?.fail_reasons ? Object.entries(stats.fail_reasons).map(([reason, count]) => ({ name: reason, count })) : []

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white">Summary & Analytics</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[240px] justify-start text-left font-normal bg-slate-800 border-slate-700 hover:bg-slate-700 text-white hover:text-white",
                  !startDate && "text-slate-400"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP") : <span>Pick a start date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
           <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[240px] justify-start text-left font-normal bg-slate-800 border-slate-700 hover:bg-slate-700 text-white hover:text-white",
                  !endDate && "text-slate-400"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "PPP") : <span>Pick an end date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button 
            onClick={handleDownloadReport}
            disabled={isDownloading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-slate-500 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? "Downloading..." : "Download Report"}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Analyzed" value={loading ? "..." : totalCount} color="bg-blue-600" />
        <StatCard label="Pass" value={loading ? "..." : passCount} color="bg-emerald-600" />
        <StatCard label="Fail" value={loading ? "..." : failCount} color="bg-red-600" />
        <StatCard label="Pass Rate" value={loading ? "..." : `${passRate}%`} color="bg-cyan-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        {!loading && totalCount > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Results Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Bar Chart */}
        {!loading && barData.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Fail Reasons</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94a3b8" />
              <YAxis type="category" dataKey="name" stroke="#94a3b8" width={150} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} />
              <Legend />
              <Bar dataKey="count" fill="#ef4444" name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`${color} rounded-lg p-6 text-white`}>
      <p className="text-sm font-medium opacity-90">{label}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  )
}
