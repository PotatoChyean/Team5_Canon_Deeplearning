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
import { Download } from "lucide-react"

// StatCard 컴포넌트를 분리하여 CSS 변수를 적용합니다.
function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
    return (
        // 🚨 StatCard는 하드코딩된 색상 클래스를 유지하고, 텍스트만 CSS 변수를 따릅니다.
        <div className={`${color} rounded-lg p-6 text-primary-foreground`}>
            <p className="text-sm font-medium opacity-90">{label}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
    )
}


export function SummaryAnalytics({ results }: any) {
    const passCount = results.filter((r: any) => r.status === "PASS").length
    const failCount = results.filter((r: any) => r.status === "FAIL").length
    const totalCount = results.length
    const passRate = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0

    // 🚨 차트 색상은 하드코딩된 값으로 고정 (테마와 무관하게 초록/빨강 유지)
    const pieData = [
        { name: "Pass", value: passCount, fill: "#34d399" }, // 고정 초록 (emerald-400)
        { name: "Fail", value: failCount, fill: "#f87171" }, // 고정 빨강 (red-400)
    ]

    const barData = [
        { name: "Jan", pass: 45, fail: 12 },
        { name: "Feb", pass: 52, fail: 18 },
        { name: "Mar", pass: 48, fail: 14 },
        { name: "Apr", pass: 61, fail: 9 },
        { name: "May", pass: 55, fail: 16 },
    ]

    return (
        <div className="space-y-6 max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">Summary & Analytics</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors">
                    <Download className="w-4 h-4" />
                    Download Report
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* 🚨 StatCard의 색상을 하드코딩된 클래스로 고정 */}
                <StatCard label="Total Analyzed" value={totalCount} color="bg-indigo-600" /> 
                <StatCard label="Pass" value={passCount} color="bg-emerald-600" />
                <StatCard label="Fail" value={failCount} color="bg-red-600" />
                <StatCard label="Pass Rate" value={`${passRate}%`} color="bg-cyan-600" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                {totalCount > 0 && (
                    // 🚨 배경과 테두리는 CSS 변수를 따르게 유지
                    <div className="bg-card border border-border rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-foreground mb-4">Results Distribution</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, value }) => `${name}: ${value}`}
                                    outerRadius={100}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ 
                                    // Tooltip 배경 및 테두리 색상을 CSS 변수로 변경
                                    backgroundColor: "var(--card)", 
                                    border: "1px solid var(--border)",
                                    color: "var(--foreground)" 
                                }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Bar Chart */}
                <div className="bg-card border border-border rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Monthly Trend</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={barData}>
                            {/* 그리드 선, 축, 툴팁 배경 등은 테마를 따르게 유지 */}
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                            <YAxis stroke="var(--muted-foreground)" />
                            <Tooltip contentStyle={{ 
                                backgroundColor: "var(--card)", 
                                border: "1px solid var(--border)",
                                color: "var(--foreground)" 
                            }} />
                            <Legend />
                            {/* 🚨 Bar fill 색상을 하드코딩된 값으로 고정 */}
                            <Bar dataKey="pass" fill="#34d399" /> 
                            <Bar dataKey="fail" fill="#f87171" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
}