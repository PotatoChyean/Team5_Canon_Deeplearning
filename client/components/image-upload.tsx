"use client"

import { useState, useEffect, Dispatch, SetStateAction } from "react" // 🚨 [수정]: useEffect, Dispatch, SetStateAction 임포트
import { Upload, File as FileIcon } from "lucide-react" 
import type React from "react"
import { File } from "lucide-react" // File 아이콘을 위한 기본 임포트 유지

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
    // 🚨 [필수 추가]: 이 props가 누락되어 오류 발생
    setProcessingCount: Dispatch<SetStateAction<number>>; 
    uploadedCount: number; 
    isProcessing: boolean;
}


export function ImageUpload({ 
    setResults, 
    onAnalysisStart, 
    setProcessingCount,
    setCompletedCount,
    uploadedCount, 
    isProcessing 
}: ImageUploadProps) {
    
    const [files, setFiles] = useState<UploadedFileItem[]>([])
    const [isDragging, setIsDragging] = useState(false)
    // 🚨 [제거]: uploadedCount, completedCount 상태는 Dashboard에서 관리합니다.


    // 헬퍼 함수: File 객체를 UploadedFileItem 타입으로 변환
    const mapFilesToUploadedItems = (fileList: File[]): UploadedFileItem[] => {
        return fileList.map(file => ({
            file: file,
            previewUrl: URL.createObjectURL(file),
            name: file.name
        }));
    };
    
    // ... (Drag/Drop 핸들러는 변경 없음) ...
    
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
    
    // 🚨 [추가]: Polling 로직 - 2초마다 진행 상황 체크 (isProcessing, uploadedCount를 props로 사용)
    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;
        
        if (isProcessing && uploadedCount > 0) {
            intervalId = setInterval(async () => {
                try {
                    const res = await fetch("http://localhost:5000/api/analysis-progress");
                    if (!res.ok) throw new Error("진행률 API 응답 오류");

                    const data = await res.json();
                    
                    setCompletedCount(data.completed_count); // 부모 상태 업데이트

                    if (data.completed_count >= uploadedCount) {
                        if (intervalId) clearInterval(intervalId);
                        // Polling이 완료되면, 최종 결과 로직은 handleStartAnalysis의 fetch 응답 후 실행됩니다.
                    }
                } catch (error) {
                    console.error("Polling 중 오류 발생:", error);
                    if (intervalId) clearInterval(intervalId);
                    // 오류 발생 시 Dashboard에서 isProcessing=false 로직이 필요합니다.
                }
            }, 2000); 
        }
        
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isProcessing, uploadedCount, setCompletedCount]); // setCompletedCount는 props로 받으므로 의존성 배열에 포함


    const handleStartAnalysis = async () => {
        if (files.length === 0) return

        // 🚨 [핵심]: 분석 시작 전, 부모에 총 파일 수를 알리고 isProcessing=true 트리거
        onAnalysisStart(files.length)
        setCompletedCount(0); // 시작 카운트 초기화

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
            setCompletedCount(files.length); 
            
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

            // 부모의 handleResultsReady 호출 -> 결과 저장 및 isProcessing=false, 탭 전환
            setResults(results) 
            
        } catch (error) {
            console.error("분석 중 오류 발생:", error)
            alert("분석 중 오류가 발생했습니다. 백엔드 서버가 실행 중인지 확인하세요.")
            // 오류 발생 시에도 isProcessing을 false로 설정하는 로직이 필요합니다.
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
            {/* ... (렌더링 부분) ... */}
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
                                    {/* Preview 이미지 표시 */}
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