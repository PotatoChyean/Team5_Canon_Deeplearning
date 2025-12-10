"use client"

import { useState, useEffect, Dispatch, SetStateAction } from "react" 
import { Upload, File as FileIcon } from "lucide-react" 
import type React from "react"
import { File } from "lucide-react"

// 1. 상태 타입 정의
type UploadedFileItem = {
    file: File;
    previewUrl: string;
    name: string;
};

// 🚨 [수정]: ImageUploadProps 인터페이스에 누락된 Props 모두 정의
interface ImageUploadProps {
    setResults: (newResults: any[]) => void;
    onAnalysisStart: (fileCount: number) => void;
    setProcessingCount: Dispatch<SetStateAction<number>>; // 👈 필수 추가
    uploadedCount: number; 
    isProcessing: boolean;
}


export function ImageUpload({ 
    setResults, 
    onAnalysisStart, 
    setProcessingCount, // 🚨 [수정]: 이 부분을 추가해야 합니다.
    uploadedCount, 
    isProcessing 
}: ImageUploadProps) {
    
    const [files, setFiles] = useState<UploadedFileItem[]>([])
    const [isDragging, setIsDragging] = useState(false)
    
    // 헬퍼 함수: File 객체를 UploadedFileItem 타입으로 변환
    const mapFilesToUploadedItems = (fileList: File[]): UploadedFileItem[] => {
        return fileList.map(file => ({
            file: file,
            previewUrl: URL.createObjectURL(file),
            name: file.name
        }));
    };
    
    // Drag/Drop 핸들러
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
        const droppedFiles = Array.from(e.dataTransfer.files) as File[]
        const filesWithPreview = mapFilesToUploadedItems(droppedFiles);
        setFiles((prev) => [...prev, ...filesWithPreview])
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files) as File[]
            const filesWithPreview = mapFilesToUploadedItems(selectedFiles)
            setFiles((prev) => [...prev, ...filesWithPreview])
        }
    }
    
    // 🚨 [추가]: Polling 로직 (useEffect)
    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;
        
        if (isProcessing && uploadedCount > 0) {
            intervalId = setInterval(async () => {
                try {
                    const res = await fetch("http://localhost:5000/api/analysis-progress");
                    if (!res.ok) throw new Error("진행률 API 응답 오류");

                    const data = await res.json();
                    
                    setProcessingCount(data.completed_count); // 부모 상태 업데이트

                    if (data.completed_count >= uploadedCount) {
                        if (intervalId) clearInterval(intervalId);
                    }
                } catch (error) {
                    console.error("Polling 중 오류 발생:", error);
                    if (intervalId) clearInterval(intervalId);
                }
            }, 2000); 
        }
        
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isProcessing, uploadedCount, setProcessingCount]);


    const handleStartAnalysis = async () => {
        if (files.length === 0) return

        // 🚨 [핵심]: 분석 시작 전, 부모에 총 파일 수를 알리고 isProcessing=true 트리거
        onAnalysisStart(files.length)
        setProcessingCount(0); // 시작 카운트 초기화

        try {
            const formData = new FormData()
            files.forEach((item) => { 
                formData.append("files", item.file as Blob)
            })

            const response = await fetch("http://localhost:5000/api/analyze-batch", {
                method: "POST",
                body: formData,
            })

            if (!response.ok) {
                throw new Error(`API 오류: ${response.statusText}`)
            }

            const data = await response.json()
            
            // 🚨 최종 완료: Polling이 응답 받기 전에 완료 상태를 잡기 위해 강제 설정
            setProcessingCount(files.length); 
            
            const results = data.results.map((result: any, index: number) => {
                const fileItem = files.find(item => item.name === result.filename); 
                
                return {
                    id: result.id || index,
                    name: result.filename,
                    status: result.status,
                    reason: result.reason || null,
                    confidence: result.confidence || 0,
                    timestamp: result.timestamp,
                    details: result.details || {},
                    previewUrl: fileItem ? fileItem.previewUrl : null,
                };
            });

            setResults(results) 
            
        } catch (error) {
            console.error("분석 중 오류 발생:", error)
            alert("분석 중 오류가 발생했습니다. 백엔드 서버가 실행 중인지 확인하세요.")
        }
    }

    const handleRemoveFile = (index: number) => {
        // Preview 메모리 해제
        const fileToRemove = files[index];
        if (fileToRemove && fileToRemove.previewUrl) {
            URL.revokeObjectURL(fileToRemove.previewUrl);
        }
        setFiles((prev) => prev.filter((_, i) => i !== index))
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                // ✅ 수정: 기존 Tailwind 컬러 대신 시맨틱 클래스 사용 (bg-card/bg-background 사용)
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${isDragging
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card/30 hover:border-primary" // hover:border-slate-500는 hover:border-primary로 통일
                    }`}
            >
                { /* ✅ 수정: text-slate-400 -> text-muted-foreground */ }
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                { /* ✅ 수정: text-white -> text-foreground */ }
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">이미지 업로드</h3>
                { /* ✅ 수정: text-slate-400 -> text-muted-foreground */ }
                <p className="text-muted-foreground mb-6">이미지를 드래그 앤 드롭하거나 파일을 선택하세요</p>
                <label
                    // ✅ 수정: bg-primary, hover:bg-primary/90, text-primary-foreground 대신 원래의 클래스 복원
                    className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors cursor-pointer"
                >
                    이미지 선택
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
                // ✅ 수정: bg-slate-800/50 -> bg-card/50, border-slate-700 -> border-border
                <div className="bg-card/50 border border-border rounded-xl p-6">
                { /* ✅ 수정: text-white -> text-foreground */ }
                    <h4 className="text-sm font-semibold text-foreground mb-4">Selected Files ({files.length})</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {files.map((item, index) => (
                            <div
                                key={index}
                                // ✅ 수정: bg-slate-900 -> bg-card, border-slate-700 -> border-border
                                className="flex items-center justify-between p-3 bg-card rounded-lg border border-border"
                            >
                                <div className="flex items-center gap-3">
                                    {/* Preview 이미지 표시 */}
                                    {item.previewUrl ? (
                                        <img
                                            src={item.previewUrl}
                                            alt={item.name}
                                            className="w-8 h-8 object-cover rounded"
                                        />
                                    ) : (
                                        // ✅ 수정: text-blue-400 -> text-primary
                                        <FileIcon className="w-4 h-4 text-primary" />
                                    )}
                                { /* ✅ 수정: text-slate-300 -> text-card-foreground */ }
                                    <span className="text-sm text-card-foreground">{item.name}</span>
                                </div>
                                <button
                                    onClick={() => handleRemoveFile(index)}
                                    // ✅ 수정: text-slate-400 -> text-muted-foreground, hover:text-red-400 -> hover:text-destructive
                                    className="text-muted-foreground hover:text-destructive transition-colors"
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
                    // ✅ 수정: bg-gradient-to-r from-primary to-accent... 대신 원래 클래스 복원
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-500/30"
                >
                    분석 시작
                </button>
            )}
        </div>
    )
}