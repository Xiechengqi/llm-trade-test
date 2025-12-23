"use client"

import type React from "react"

import { TableHeader } from "@/components/ui/table"
import { CandlestickChart } from "@/components/candlestick-chart"
import type { KlineData } from "@/lib/types"
import type { IndicatorConfig } from "@/components/indicators-dropdown"

import { CardDescription } from "@/components/ui/card"
import {
  Copy,
  Pencil,
  List,
  Eye,
  EyeOff,
  RotateCcw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Play,
  StopCircle,
  Download,
  Zap,
  FileText,
  Upload,
  ImageIcon,
  X,
  Link,
  ZoomIn,
  Loader2,
  RefreshCw,
  Heart,
} from "lucide-react" // Import Copy, Pencil, List, Eye, EyeOff, RotateCcw, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Calendar, Check, Clock, X, Play, StopCircle icons

import { useState, useEffect, useRef, useMemo, useCallback } from "react" // Import useRef, useMemo, useCallback
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { TableBody, TableCell, TableHead, TableRow, Table } from "@/components/ui/table" // Import Table components
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent } from "@/components/ui/dialog"

type IndicatorFilterKey = `indicator-${number}`
type ContextFilter = "all" | "kline" | IndicatorFilterKey
import {
  calculateATR,
  calculateBOLL,
  calculateEMA,
  calculateKDJ,
  calculateMACD,
  calculateMFI,
  calculateMA,
  calculateOBV,
  calculateRSI,
  calculateVWAP,
  calculateVPT,
} from "@/lib/indicators"

import {
  initDB,
  saveHistoryToDB,
  loadHistoryFromDB,
  saveImagesToDB,
  loadImagesToDB, // Added loadImagesToDB import
  saveResponseImagesToDB,
  loadResponseImagesFromDB,
  deleteResponseImagesFromDB,
  migrateFromLocalStorage,
  clearAllData,
} from "@/lib/indexed-db"

const DB_NAME = "llm-api-tester-db"
const DB_VERSION = 1
const STORE_NAME = "fileHandles"

// Declare verifyFilePermission here if it's expected to be globally available or imported elsewhere
declare global {
  interface Window {
    // Define verifyFilePermission if it's a global function attached to window
    verifyFilePermission?: (handle: FileSystemFileHandle) => Promise<boolean>
  }
}

// Assume verifyFilePermission is available globally or imported
// If it's a locally defined function, it should be declared above or imported.
// For the purpose of this merge, we'll assume it's correctly defined or imported elsewhere.
// If it's expected to be a new function, it needs to be implemented.
const verifyFilePermission = async (handle: FileSystemFileHandle): Promise<boolean> => {
  try {
    if (handle.queryPermission) {
      // Check current permission status
      const status = await handle.queryPermission({ mode: "read" })

      if (status === "granted") {
        return true
      }

      // If not granted, request permission
      const requestStatus = await handle.requestPermission({ mode: "read" })
      return requestStatus === "granted"
    }
    // Fallback for environments where queryPermission might not be available
    return true
  } catch (error) {
    console.error("[v0] Error checking/requesting file permission:", error)
    return false
  }
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => {
      console.log("[v0] IndexedDB open error:", request.error)
      reject(request.error)
    }
    request.onsuccess = () => {
      console.log("[v0] IndexedDB opened successfully")
      resolve(request.result)
    }
    request.onupgradeneeded = (event) => {
      console.log("[v0] IndexedDB upgrade needed, creating object store")
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

const saveFileHandle = async (key: string, handle: FileSystemFileHandle): Promise<boolean> => {
  console.log("[v0] saveFileHandle called with key:", key, "handle:", handle)
  try {
    const db = await openDB()
    console.log("[v0] DB opened for saving, starting transaction...")

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)

      console.log("[v0] Putting handle into store...")
      const request = store.put(handle, key)

      request.onerror = (e) => {
        console.log("[v0] Put request error:", request.error, e)
      }

      request.onsuccess = () => {
        console.log("[v0] Put request success for:", key)
      }

      // Wait for transaction to complete, not just the put request
      tx.oncomplete = () => {
        console.log("[v0] Transaction completed successfully for:", key)
        db.close()
        resolve(true)
      }

      tx.onerror = (e) => {
        console.log("[v0] Transaction error:", tx.error, e)
        db.close()
        resolve(false)
      }

      tx.onabort = (e) => {
        console.log("[v0] Transaction aborted:", tx.error, e)
        db.close()
        resolve(false)
      }
    })
  } catch (error) {
    console.log("[v0] Error in saveFileHandle:", error)
    return false
  }
}

const getFileHandle = async (key: string): Promise<FileSystemFileHandle | null> => {
  console.log("[v0] getFileHandle called with key:", key)
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly")
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(key)

      request.onerror = () => {
        console.log("[v0] Failed to get file handle:", request.error)
        db.close()
        resolve(null)
      }

      request.onsuccess = () => {
        const handle = request.result || null
        console.log("[v0] Got file handle from IndexedDB:", key, handle ? "found" : "not found")
        db.close()
        resolve(handle)
      }
    })
  } catch (error) {
    console.log("[v0] Error in getFileHandle:", error)
    return null
  }
}

const deleteFileHandle = async (key: string): Promise<void> => {
  console.log("[v0] deleteFileHandle called with key:", key)
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(key)

      tx.oncomplete = () => {
        console.log("[v0] Delete transaction completed for:", key)
        db.close()
        resolve()
      }

      tx.onerror = () => {
        console.log("[v0] Delete transaction error:", tx.error)
        db.close()
        resolve()
      }
    })
  } catch (error) {
    console.log("[v0] Failed to delete file handle from IndexedDB:", error)
  }
}

interface OpenRouterModel {
  id: string
  name?: string
  provider?: string
  description?: string
  link?: string
  pub_date?: string
  context_length?: number
  architecture?: {
    input_modalities?: string[]
    output_modalities?: string[]
    modality?: string
    tokenizer?: string
    instruct_type?: string | null
  }
  pricing?: {
    prompt?: string
    completion?: string
    [key: string]: any
  }
  created?: number
  // Add other properties as per the actual API response
}

interface CerebrasModel {
  id: string
  name?: string
  provider?: string
  description?: string
  link?: string
  pub_date?: string
  context_length?: number
  // Add other properties as per the actual API response
}

interface ModelScopeModel {
  id: string
  name?: string
  provider?: string
  description?: string
  link?: string
  pub_date?: string
  time?: string // 时间
  context_length?: number
  task_types?: string | string[] // 可能是字符串或字符串数组
  downloads?: number // 下载量
  stars?: number // 点赞数
  // Add other properties as per the actual API response
}

const API_PROVIDERS = [
  {
    id: "openrouter",
    name: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    endpoint: "https://api.deepseek.com/v1/chat/completions",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    endpoint: "https://api.cerebras.ai/v1/chat/completions",
  },
  {
    id: "modelscope",
    name: "ModelScope",
    endpoint: "https://api-inference.modelscope.cn/v1/chat/completions",
  },
  {
    id: "custom",
    name: "自定义",
    endpoint: "",
  },
]

interface ModelHistoryItem {
  id: string
  timestamp: number
  provider: string
  model: string
  apiKey: string
  baseURL: string
  apiPath: string
  status: "idle" | "success" | "error"
  duration: number | null
}

interface HistoryItem {
  id: string
  timestamp: number
  duration?: number // Response time in milliseconds
  model: string // Add model field to HistoryItem interface
  tradingPair?: string
  requestContent: string
  requestRaw: string
  responseContent: string
  responseRaw: string
  contextTags?: string[]
}

interface MessageImage {
  id: string
  type: "url" | "file"
  url?: string // For URL type
  base64?: string // For file type
  mimeType?: string // For file type
  name?: string // Original file name
}

const extractImagesFromRequestContent = (requestContent: string): string[] => {
  if (!requestContent || requestContent.trim() === "") {
    return []
  }

  try {
    const parsed = JSON.parse(requestContent)
    const images: string[] = []

    // Handle full messages array format
    if (Array.isArray(parsed)) {
      parsed.forEach((message: any) => {
        // Check if this is a message object with content array
        if (message.content && Array.isArray(message.content)) {
          message.content.forEach((item: any) => {
            if (item.type === "image_url" && item.image_url?.url) {
              const url = item.image_url.url
              // Accept both regular URLs and data:image base64 strings
              if (url.startsWith("data:image/") || url.startsWith("http://") || url.startsWith("https://")) {
                images.push(url)
              }
            }
          })
        } else if (message.content && typeof message.content === "string") {
          // This part is for the old format where userMessage was a string and images were implicitly handled if any.
          // However, the new format uses message.content array.
          // This fallback might be needed if mixed formats are encountered or for older history entries.
          // For now, we prioritize the structured format.
        }
      })
    }

    return images
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[v0] Error parsing request content for images:", error)
    }
    return []
  }
}

// 提取响应中的图片（同步版本，从状态中获取）
const extractImagesFromResponseContent = (
  responseContent: string,
  responseRaw: string,
  responseImagesMap?: Map<number, string[]>,
  historyTimestamp?: number,
): string[] => {
  if (!responseContent || responseContent.trim() === "") {
    return []
  }

  // 如果提供了 historyTimestamp 和 responseImagesMap，优先从状态中获取
  if (historyTimestamp !== undefined && responseImagesMap) {
    const savedImages = responseImagesMap.get(historyTimestamp)
    if (savedImages && savedImages.length > 0) {
      return savedImages
    }
  }

  // 尝试从 responseContent 中提取 base64 图片（如果是 base64 格式）
  if (responseContent.startsWith("data:image")) {
    return [responseContent]
  }

  // 如果 responseContent 包含多个 base64 图片（用换行符分隔）
  if (responseContent.includes("\n") && responseContent.split("\n").every((line) => line.startsWith("data:image"))) {
    return responseContent.split("\n").filter(Boolean)
  }

  try {
    // 尝试从 responseRaw 解析
    const parsed = JSON.parse(responseRaw)
    const images: string[] = []

    // Handle wrapped response format (with body property)
    let responseBody = parsed
    if (parsed.body && typeof parsed.body === "object") {
      responseBody = parsed.body
    }

    // Check for ModelScope image generation format: body.images[0].url
    if (responseBody.images && Array.isArray(responseBody.images)) {
      responseBody.images.forEach((img: any) => {
        if (img.url && (img.url.startsWith("http://") || img.url.startsWith("https://"))) {
          images.push(img.url)
        }
      })
    }

    // Check if it's a standard API response with choices array
    if (responseBody.choices && Array.isArray(responseBody.choices)) {
      responseBody.choices.forEach((choice: any) => {
        // Check for images in message.images array
        if (choice.message && choice.message.images && Array.isArray(choice.message.images)) {
          choice.message.images.forEach((img: any) => {
            if (img.image_url && img.image_url.url) {
              const url = img.image_url.url
              // Accept both base64 data URLs and HTTP/HTTPS URLs
              if (url.startsWith("data:image") || url.startsWith("http://") || url.startsWith("https://")) {
                images.push(url)
              }
            }
          })
        }
      })
    }

    return images
  } catch (error) {
    console.error("[v0] Error extracting images from response:", error)
    return []
  }
}

// 异步加载历史记录的响应图片
const loadResponseImagesForHistory = async (historyItems: HistoryItem[]) => {
  const imagesMap = new Map<number, string[]>()

  for (const item of historyItems) {
    try {
      const savedImages = await loadResponseImagesFromDB(item.timestamp)
      if (savedImages.length > 0) {
        const base64Images = savedImages.map((img) => img.base64 || img.url || "").filter(Boolean)
        if (base64Images.length > 0) {
          imagesMap.set(item.timestamp, base64Images)
        }
      }
    } catch (error) {
      console.warn(`[v0] Failed to load response images for timestamp ${item.timestamp}:`, error)
    }
  }

  return imagesMap
}

const formatRequestContentForDisplay = (requestContent: string): string => {
  try {
    const parsed = JSON.parse(requestContent)

    // Handle full messages array format
    if (Array.isArray(parsed)) {
      let textParts: string[] = []

      parsed.forEach((message: any) => {
        if (message.content) {
          if (typeof message.content === "string") {
            // For older history items or messages without explicit image_url
            textParts.push(message.content)
          } else if (Array.isArray(message.content)) {
            // For messages with explicit content array (multimodal)
            const messageParts = message.content
              .filter((item: any) => item.type === "text")
              .map((item: any) => item.text)
            textParts = textParts.concat(messageParts)
          }
        }
      })

      return textParts.join("\n")
    }

    return requestContent
  } catch (error) {
    return requestContent
  }
}

export default function Home() {
  // CHANGE: Renamed component from LLMAPITester to Home
  const DEFAULT_VALUES = {
    provider: "openrouter" as const,
    model: "",
    apiKey: "", // Added default for apiKey
    baseURL: "https://openrouter.ai",
    apiPath: "/api/v1/chat/completions",
    systemPrompt: `Role: 你是一位精通价格行为（Price Action）与量化分析的加密货币首席分析师。你擅长从原始 OHLCV 数据中剥离噪音,识别趋势拐点及高盈亏比的交易机会。
Core Skills:
数据清洗与计算： 能够根据收盘价序列计算简单的移动平均线 (MA)、波动率 (ATR) 及强弱指标 (RSI)。
形态识别： 识别吞没形态、锤头线、穿头破脚、V型反转等经典 K 线组合。
量价分析： 分析成交量对价格变动的支撑性（如：放量突破 vs 缩量上涨）。
支撑/压力探测： 从历史高低点中锁定关键的流动性区域。
ANALYSIS LOGIC (逻辑分析步骤):
形态特征扫描：
分析最近 3-5 根 K 线：是连续阳线/阴线？实体大小是否在衰减？
是否存在长影线（插针）：判断影线出现的关键价格位及其代表的供需压力。
量价配合度：
确认当前的价格波动是否有成交量支撑（Volume Confirmation）。
波动率评估：
观察高低点波动范围（High-Low Spread），判断市场是处于"低波动蓄势"还是"高波动洗盘"。
趋势结构定义：
使用 Higher Highs/Lower Lows 定义当前是 Bullish Trend, Bearish Trend 还是 Range-bound。
FORMATTED OUTPUT (格式化输出规范):
你必须严格按照以下 Markdown 结构回复，禁止闲聊：
markdown
### 📊 市场盘面量化分析报告
**交易对:** [币种] | **周期:** [时间维度] | **分析时刻:** [数据最后一根K线的时间]

#### 1. 价格行为综述 (Price Action)
*   **当前趋势:** [例如：1h 级别 V型反转后进入高位震荡]
*   **最近动态:** [描述最后 3 根 K 线的实体与量比关系]
*   **关键位:**
    *   🔴 阻力位: [价格1], [价格2]
    *   🟢 支撑位: [价格1], [价格2]

#### 2. 量价异动检测 (Volume Analysis)
*   [例如：2025-12-19 03:00 出现放量下跌，成交量4102为近期最高，显示卖盘恐慌，但随后价格回升，形成卖盘枯竭。]

#### 3. 交易策略建议 (Tactical Advice)

| 策略类型 | 触发条件 | 入场目标 | 止损 (SL) | 止盈 (TP) | 盈亏比  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| 多单 (Long)    | 突破并回测 [价格]   | [价格]   | [价格]    | [价格]    | [X:1]   |
| 空单 (Short)   | 跌破 [价格] 确认    | [价格]   | [价格]    | [价格]    | [X:1]   |

#### 4. 极端风险提示
[例如：RSI 处于高位且成交量持续萎缩，存在二探底部的风险。]`,
    userMessage: "",
    promptFilePath: "",
    enablePromptFile: false, // Add enablePromptFile state with default false
    systemPromptFilePath: "",
    enableSystemPromptFile: false,
    autoReloadPrompt: false,
    autoReloadSystemPrompt: false,
    autoReloadImages: false,
    maxTokens: 4096,
    temperature: 1.0,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    showRawColumns: false,
    expandRequestContent: false,
    expandResponseContent: false,
    timerEnabled: false,
    timerInterval: 60,
    maxTokensLimit: 8192,
    pageSize: 3,
    prompt: "", // Added prompt to default values
  }

  const [provider, setProvider] = useState(DEFAULT_VALUES.provider)
  const [endpoint, setEndpoint] = useState("") // This state seems redundant with baseURL, consider consolidating.
  const [apiKey, setApiKey] = useState(DEFAULT_VALUES.apiKey)
  const [showApiKey, setShowApiKey] = useState(false)
  const [isPromptExpanded, setIsPromptExpanded] = useState(false)
  const [isContextExpanded, setIsContextExpanded] = useState(false)
  const [isSystemPromptExpanded, setIsSystemPromptExpanded] = useState(false)
  const [model, setModel] = useState("")
  const [openrouterModels, setOpenrouterModels] = useState<OpenRouterModel[]>([])
  const [cerebrasModels, setCerebrasModels] = useState<CerebrasModel[]>([])
  const [modelscopeModels, setModelscopeModels] = useState<ModelScopeModel[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [isCustomModel, setIsCustomModel] = useState(false)
  const [selectedInputModalities, setSelectedInputModalities] = useState<string[]>([])
  const [selectedOutputModalities, setSelectedOutputModalities] = useState<string[]>([])
  const [modelSearchQuery, setModelSearchQuery] = useState("")
  const [translatedDescription, setTranslatedDescription] = useState<string>("")
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string>("")
  const [maxTokens, setMaxTokens] = useState(DEFAULT_VALUES.maxTokens)
  const [temperature, setTemperature] = useState(DEFAULT_VALUES.temperature)
  const [topP, setTopP] = useState(DEFAULT_VALUES.topP)
  const [frequencyPenalty, setFrequencyPenalty] = useState(DEFAULT_VALUES.frequencyPenalty)
  const [presencePenalty, setPresencePenalty] = useState(DEFAULT_VALUES.presencePenalty)
  const [stream, setStream] = useState(false) // Added stream state
  const [loading, setLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [requestData, setRequestData] = useState("")
  const [responseData, setResponseData] = useState("")
  const [error, setError] = useState("")
  const [maxTokensLimit, setMaxTokensLimit] = useState(DEFAULT_VALUES.maxTokensLimit)
  const [prompt, setPrompt] = useState(DEFAULT_VALUES.prompt) // This state seems redundant with userMessage, consider consolidating.

  const [baseURL, setBaseURL] = useState(DEFAULT_VALUES.baseURL) // Added baseURL state
  const [apiPath, setApiPath] = useState(DEFAULT_VALUES.apiPath) // Added apiPath state
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_VALUES.systemPrompt) // Added systemPrompt state
  const [userMessage, setUserMessage] = useState(DEFAULT_VALUES.userMessage) // Added userMessage state
  const [context, setContext] = useState("") // Context for K-line data and other context information
  const [contextFilter, setContextFilter] = useState<ContextFilter>("all")
  const [contextIndicators, setContextIndicators] = useState<IndicatorConfig[]>([])
  const [promptFilePath, setPromptFilePath] = useState(DEFAULT_VALUES.promptFilePath)
  const [enablePromptFile, setEnablePromptFile] = useState(DEFAULT_VALUES.enablePromptFile) // Add enablePromptFile state
  const [isPromptFromLocalFile, setIsPromptFromLocalFile] = useState(false)
  const promptFileHandleRef = useRef<FileSystemFileHandle | null>(null)

  const [loadedPromptContent, setLoadedPromptContent] = useState("")
  const [isExternalPromptExpanded, setIsExternalPromptExpanded] = useState(false)

  const [systemPromptFilePath, setSystemPromptFilePath] = useState(DEFAULT_VALUES.systemPromptFilePath)
  const [enableSystemPromptFile, setEnableSystemPromptFile] = useState(DEFAULT_VALUES.enableSystemPromptFile)
  const [isSystemPromptFromLocalFile, setIsSystemPromptFromLocalFile] = useState(false)
  const systemPromptFileHandleRef = useRef<FileSystemFileHandle | null>(null)

  const [loadedSystemPromptContent, setLoadedSystemPromptContent] = useState("")
  const [isExternalSystemPromptExpanded, setIsExternalSystemPromptExpanded] = useState(false)

  const [autoReloadPrompt, setAutoReloadPrompt] = useState(DEFAULT_VALUES.autoReloadPrompt)
  const [autoReloadSystemPrompt, setAutoReloadSystemPrompt] = useState(DEFAULT_VALUES.autoReloadSystemPrompt)
  const [autoReloadImages, setAutoReloadImages] = useState(DEFAULT_VALUES.autoReloadImages)

  const [history, setHistory] = useState<HistoryItem[]>([])
  const [pageSize, setPageSize] = useState(DEFAULT_VALUES.pageSize)
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set())
  const [visibleRawCells, setVisibleRawCells] = useState<Set<string>>(new Set()) // State to track visible raw columns per history item
  const [showRawColumns, setShowRawColumns] = useState<boolean>(DEFAULT_VALUES.showRawColumns)
  const [showRequestContent, setShowRequestContent] = useState<boolean>(false)
  const [expandRequestContent, setExpandRequestContent] = useState<boolean>(DEFAULT_VALUES.expandRequestContent)
  const [expandResponseContent, setExpandResponseContent] = useState<boolean>(DEFAULT_VALUES.expandResponseContent)
  const [parseResponseMarkdown, setParseResponseMarkdown] = useState<boolean>(true)

  const [probeStatus, setProbeStatus] = useState<"idle" | "success" | "error">("idle")
  const [probeDuration, setProbeDuration] = useState<number | null>(null)
  const [isProbeTesting, setIsProbeTesting] = useState(false)

  const [timerEnabled, setTimerEnabled] = useState(DEFAULT_VALUES.timerEnabled)
  const [timerInterval, setTimerInterval] = useState(DEFAULT_VALUES.timerInterval)
  const timerRef = useRef<NodeJS.Timeout | null>(null) // Use useRef for timer
  const [isTimerRunning, setIsTimerRunning] = useState(false) // Track if timer is active
  const isTimerRunningRef = useRef(false) // Ref to track timer state for immediate access
  const [responseDuration, setResponseDuration] = useState<number | null>(null)
  const [isParametersExpanded, setIsParametersExpanded] = useState(false)

  const [modelHistory, setModelHistory] = useState<ModelHistoryItem[]>([])
  const [modelHistoryPage, setModelHistoryPage] = useState(1)
  const modelHistoryPageSize = 5
  const [responseImagesMap, setResponseImagesMap] = useState<Map<number, string[]>>(new Map())
  const [visibleApiKeys, setVisibleApiKeys] = useState<Set<string>>(new Set())

  const [availableInputModalities, setAvailableInputModalities] = useState<string[]>([])
  const [availableOutputModalities, setAvailableOutputModalities] = useState<string[]>([])

  const [messageImages, setMessageImages] = useState<MessageImage[]>([])
  const [imageUrl, setImageUrl] = useState("")
  const [showImageUrlInput, setShowImageUrlInput] = useState(false)
  const [isAddingImageUrl, setIsAddingImageUrl] = useState(false)
  const [zoomedImage, setZoomedImage] = useState<MessageImage | null>(null)

  // CHANGE: Initialize K-line chart state from localStorage
  const [klineLimit, setKlineLimit] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("klineLimit")
      return saved ? Number.parseInt(saved) : 100
    }
    return 100
  })

  const [tradingPair, setTradingPair] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("tradingPair")
      return saved || "BTCUSDT"
    }
    return "BTCUSDT"
  })

  const [klineInterval, setKlineInterval] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("klineInterval")
      return saved || "1h"
    }
    return "1h"
  })

  const [markedCandleTime, setMarkedCandleTime] = useState<number | null>(null)

  const [klineData, setKlineData] = useState<KlineData[]>([])
  const [isLoadingKline, setIsLoadingKline] = useState(false)
  const [tradingPairSearch, setTradingPairSearch] = useState("")
  const [klineEndTime, setKlineEndTime] = useState<number | undefined>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("klineEndTime")
      return saved ? Number.parseInt(saved) : undefined
    }
    return undefined
  })

  // CHANGE: Save K-line chart settings to localStorage when they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("tradingPair", tradingPair)
    }
  }, [tradingPair])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("klineInterval", klineInterval)
    }
  }, [klineInterval])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("klineLimit", klineLimit.toString())
    }
  }, [klineLimit])

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (klineEndTime !== undefined) {
        localStorage.setItem("klineEndTime", klineEndTime.toString())
      } else {
        localStorage.removeItem("klineEndTime")
      }
    }
  }, [klineEndTime])

  // Popular trading pairs for quick selection - organized by category
  const popularPairs = [
    // ========== US Stocks ==========
    // Magnificent 7
    "STOCK:AAPL", // Apple
    "STOCK:MSFT", // Microsoft
    "STOCK:GOOGL", // Alphabet (Google)
    "STOCK:AMZN", // Amazon
    "STOCK:NVDA", // NVIDIA
    "STOCK:META", // Meta (Facebook)
    "STOCK:TSLA", // Tesla
    // Top Tech Stocks
    "STOCK:AMD", // AMD
    "STOCK:INTC", // Intel
    "STOCK:CRM", // Salesforce
    "STOCK:ORCL", // Oracle
    "STOCK:ADBE", // Adobe
    "STOCK:NFLX", // Netflix
    "STOCK:AVGO", // Broadcom
    "STOCK:QCOM", // Qualcomm
    "STOCK:CSCO", // Cisco
    "STOCK:IBM", // IBM
    "STOCK:TXN", // Texas Instruments
    "STOCK:MU", // Micron
    "STOCK:AMAT", // Applied Materials
    "STOCK:LRCX", // Lam Research
    "STOCK:KLAC", // KLA Corporation
    "STOCK:ASML", // ASML
    "STOCK:TSM", // TSMC
    "STOCK:SNOW", // Snowflake
    "STOCK:PLTR", // Palantir
    "STOCK:NET", // Cloudflare
    "STOCK:DDOG", // Datadog
    "STOCK:ZS", // Zscaler
    "STOCK:CRWD", // CrowdStrike
    "STOCK:PANW", // Palo Alto Networks
    // Financials
    "STOCK:JPM", // JPMorgan Chase
    "STOCK:BAC", // Bank of America
    "STOCK:WFC", // Wells Fargo
    "STOCK:GS", // Goldman Sachs
    "STOCK:MS", // Morgan Stanley
    "STOCK:C", // Citigroup
    "STOCK:BLK", // BlackRock
    "STOCK:SCHW", // Charles Schwab
    "STOCK:V", // Visa
    "STOCK:MA", // Mastercard
    "STOCK:AXP", // American Express
    "STOCK:PYPL", // PayPal
    "STOCK:SQ", // Block (Square)
    "STOCK:COIN", // Coinbase
    // Healthcare & Pharma
    "STOCK:JNJ", // Johnson & Johnson
    "STOCK:UNH", // UnitedHealth
    "STOCK:PFE", // Pfizer
    "STOCK:MRK", // Merck
    "STOCK:ABBV", // AbbVie
    "STOCK:LLY", // Eli Lilly
    "STOCK:BMY", // Bristol-Myers Squibb
    "STOCK:AMGN", // Amgen
    "STOCK:GILD", // Gilead Sciences
    "STOCK:MRNA", // Moderna
    "STOCK:REGN", // Regeneron
    "STOCK:VRTX", // Vertex Pharmaceuticals
    "STOCK:ISRG", // Intuitive Surgical
    // Consumer & Retail
    "STOCK:WMT", // Walmart
    "STOCK:COST", // Costco
    "STOCK:HD", // Home Depot
    "STOCK:TGT", // Target
    "STOCK:LOW", // Lowe's
    "STOCK:NKE", // Nike
    "STOCK:SBUX", // Starbucks
    "STOCK:MCD", // McDonald's
    "STOCK:KO", // Coca-Cola
    "STOCK:PEP", // PepsiCo
    "STOCK:PG", // Procter & Gamble
    // Energy
    "STOCK:XOM", // ExxonMobil
    "STOCK:CVX", // Chevron
    "STOCK:COP", // ConocoPhillips
    "STOCK:OXY", // Occidental Petroleum
    "STOCK:SLB", // Schlumberger
    // Industrials & Defense
    "STOCK:BA", // Boeing
    "STOCK:LMT", // Lockheed Martin
    "STOCK:RTX", // Raytheon
    "STOCK:GE", // General Electric
    "STOCK:CAT", // Caterpillar
    "STOCK:HON", // Honeywell
    "STOCK:UPS", // UPS
    "STOCK:FDX", // FedEx
    // EV & Automotive
    "STOCK:RIVN", // Rivian
    "STOCK:LCID", // Lucid Motors
    "STOCK:F", // Ford
    "STOCK:GM", // General Motors
    "STOCK:TM", // Toyota
    // Entertainment & Media
    "STOCK:DIS", // Disney
    "STOCK:WBD", // Warner Bros Discovery
    "STOCK:PARA", // Paramount
    "STOCK:SPOT", // Spotify
    "STOCK:RBLX", // Roblox
    "STOCK:EA", // Electronic Arts
    "STOCK:TTWO", // Take-Two Interactive
    // AI & Robotics
    "STOCK:ARM", // ARM Holdings
    "STOCK:AI", // C3.ai
    "STOCK:PATH", // UiPath
    "STOCK:UPST", // Upstart
    "STOCK:SMCI", // Super Micro Computer
    // Chinese ADRs
    "STOCK:BABA", // Alibaba
    "STOCK:JD", // JD.com
    "STOCK:PDD", // PDD Holdings (Pinduoduo)
    "STOCK:BIDU", // Baidu
    "STOCK:NIO", // NIO
    "STOCK:XPEV", // XPeng
    "STOCK:LI", // Li Auto
    "STOCK:BILI", // Bilibili
    "STOCK:TME", // Tencent Music
    // ETFs
    "STOCK:SPY", // S&P 500 ETF
    "STOCK:QQQ", // Nasdaq 100 ETF
    "STOCK:IWM", // Russell 2000 ETF
    "STOCK:DIA", // Dow Jones ETF
    "STOCK:VTI", // Total Stock Market ETF
    "STOCK:ARKK", // ARK Innovation ETF
    "STOCK:XLF", // Financial Select Sector ETF
    "STOCK:XLE", // Energy Select Sector ETF
    "STOCK:XLK", // Technology Select Sector ETF
    "STOCK:SOXX", // Semiconductor ETF
    "STOCK:GLD", // Gold ETF
    "STOCK:SLV", // Silver ETF
    "STOCK:USO", // Oil ETF
    "STOCK:TLT", // 20+ Year Treasury Bond ETF
    "STOCK:VIX", // Volatility Index
    // Top Cryptocurrencies by Market Cap
    "BTCUSDT", // Bitcoin
    "ETHUSDT", // Ethereum
    "BNBUSDT", // Binance Coin
    "XRPUSDT", // Ripple
    "SOLUSDT", // Solana
    "ADAUSDT", // Cardano
    "DOGEUSDT", // Dogecoin
    "TRXUSDT", // TRON
    "TONUSDT", // Toncoin
    "LINKUSDT", // Chainlink
    "AVAXUSDT", // Avalanche
    "XLMUSDT", // Stellar
    "SUIUSDT", // Sui
    "DOTUSDT", // Polkadot
    "BCHUSDT", // Bitcoin Cash
    "SHIBUSDT", // Shiba Inu
    "LTCUSDT", // Litecoin
    "UNIUSDT", // Uniswap
    "ATOMUSDT", // Cosmos
    "NEARUSDT", // NEAR Protocol
    "ICPUSDT", // Internet Computer
    "APTUSDT", // Aptos
    "ETCUSDT", // Ethereum Classic
    "STXUSDT", // Stacks
    "RENDERUSDT", // Render
    "IMXUSDT", // Immutable X
    "FILUSDT", // Filecoin
    "HBARUSDT", // Hedera
    "INJUSDT", // Injective
    "OPUSDT", // Optimism
    "ARBUSDT", // Arbitrum
    "VETUSDT", // VeChain
    "AAVEUSDT", // Aave
    "MKRUSDT", // Maker
    "GRTUSDT", // The Graph
    "RUNEUSDT", // THORChain
    "ALGOUSDT", // Algorand
    "FTMUSDT", // Fantom
    "SANDUSDT", // The Sandbox
    "MANAUSDT", // Decentraland
    "AXSUSDT", // Axie Infinity
    "THETAUSDT", // Theta Network
    "EGLDUSDT", // MultiversX
    "FLOWUSDT", // Flow
    "NEOUSDT", // NEO
    "XTZUSDT", // Tezos
    "EOSUSDT", // EOS
    "SNXUSDT", // Synthetix
    "CRVUSDT", // Curve DAO
    "COMPUSDT", // Compound
    "1INCHUSDT", // 1inch
    "APEUSDT", // ApeCoin
    "LRCUSDT", // Loopring
    "ENJUSDT", // Enjin Coin
    "CHZUSDT", // Chiliz
    "BATUSDT", // Basic Attention Token
    "ZILUSDT", // Zilliqa
    "ZRXUSDT", // 0x
    "KAVAUSDT", // Kava
    "KSMUSDT", // Kusama
    "DASHUSDT", // Dash
    "ZECUSDT", // Zcash
    "WAVESUSDT", // Waves
    "QNTUSDT", // Quant
    "LDOUSDT", // Lido DAO
    "RPLETH", // Rocket Pool
    "SSVUSDT", // SSV Network
    "PENDLEUSDT", // Pendle
    "GMXUSDT", // GMX
    "DYDXUSDT", // dYdX
    "MASKUSDT", // Mask Network
    "IOTAUSDT", // IOTA
    "ONTUSDT", // Ontology
    "ICXUSDT", // ICON
    "SKLUSDT", // SKALE
    "ANKRUSDT", // Ankr
    "STORJUSDT", // Storj
    "CELRUSDT", // Celer Network
    "CKBUSDT", // Nervos Network
    "HOTUSDT", // Holo
    "SCUSDT", // Siacoin
    "RVNUSDT", // Ravencoin
    // Meme Coins
    "PEPEUSDT", // Pepe
    "WIFUSDT", // dogwifhat
    "FLOKIUSDT", // Floki
    "BONKUSDT", // Bonk
    "BOMEUSDT", // BOOK OF MEME
    // Layer 2 & Scaling
    "MATICUSDT", // Polygon
    "ARBUSDT", // Arbitrum
    "OPUSDT", // Optimism
    "STRKUSDT", // Starknet
    "ZKUSDT", // zkSync
    "MANTAUSDT", // Manta Network
    "BLURUSDT", // Blur
    "TIAUSDT", // Celestia
    "JUPUSDT", // Jupiter
    "WUSDT", // Wormhole
    "ENAUSDT", // Ethena
    "ALTUSDT", // AltLayer
    "PIXELUSDT", // Pixels
    "PORTALUSDT", // Portal
    "AIUSDT", // Sleepless AI
    "XAIUSDT", // Xai
    "ACEUSDT", // Fusionist
    "NFPUSDT", // NFPrompt
    // BTC Pairs
    "ETHBTC", // ETH/BTC
    "BNBBTC", // BNB/BTC
    "XRPBTC", // XRP/BTC
    "SOLBTC", // SOL/BTC
    "ADABTC", // ADA/BTC
    "DOTBTC", // DOT/BTC
    "LINKBTC", // LINK/BTC
    "LTCBTC", // LTC/BTC
    "AVAXBTC", // AVAX/BTC
    "ATOMBTC", // ATOM/BTC
    // ETH Pairs
    "BNBETH", // BNB/ETH
    "LINKETH", // LINK/ETH
    "UNISWAPETH", // UNI/ETH
    "AAVEETH", // AAVE/ETH
    "MKRAETH", // MKR/ETH
    // Stablecoins Pairs
    "BTCUSDC", // BTC/USDC
    "ETHUSDC", // ETH/USDC
    "BTCTUSD", // BTC/TUSD
    "BTCFDUSD", // BTC/FDUSD
    "ETHFDUSD", // ETH/FDUSD
    // FIAT Pairs
    "BTCEUR", // BTC/EUR
    "ETHEUR", // ETH/EUR
    "BTCGBP", // BTC/GBP
    "ETHGBP", // ETH/GBP
    "BTCBRL", // BTC/BRL
    "BTCTRY", // BTC/TRY
  ]

  // K-line intervals
  const intervals = [
    { value: "1m", label: "1分钟" },
    { value: "3m", label: "3分钟" }, // Added 3m interval
    { value: "5m", label: "5分钟" },
    { value: "15m", label: "15分钟" },
    { value: "30m", label: "30分钟" },
    { value: "1h", label: "1小时" },
    { value: "2h", label: "2小时" }, // Added 2h interval
    { value: "4h", label: "4小时" },
    { value: "6h", label: "6小时" }, // Added 6h interval
    { value: "8h", label: "8小时" }, // Added 8h interval
    { value: "12h", label: "12小时" }, // Added 12h interval
    { value: "1d", label: "1天" },
    { value: "3d", label: "3天" }, // Added 3d interval
    { value: "1w", label: "1周" },
    { value: "1M", label: "1月" }, // Added 1M interval
  ]

  const { toast } = useToast()

  // Use a unified endpoint for API calls
  const unifiedEndpoint = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL // Remove trailing slash

  const fetchKlineData = useCallback(
    async (pair: string, interval: string, limit: number, endTime?: number): Promise<KlineData[]> => {
      setIsLoadingKline(true)
      console.log("[v0] Fetching K-line data:", { pair, interval, limit, endTime })
      try {
        const isStock = pair.startsWith("STOCK:")

        if (isStock) {
          // Extract the actual stock symbol
          const stockSymbol = pair.replace("STOCK:", "")

          // Convert crypto interval to Yahoo Finance interval and period
          // Yahoo Finance intervals: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
          let yahooInterval = "1d"
          let range = "1y"

          switch (interval) {
            case "1m":
              yahooInterval = "1m"
              range = "1d"
              break
            case "3m":
              yahooInterval = "5m"
              range = "5d"
              break
            case "5m":
              yahooInterval = "5m"
              range = "5d"
              break
            case "15m":
              yahooInterval = "15m"
              range = "5d"
              break
            case "30m":
              yahooInterval = "30m"
              range = "1mo"
              break
            case "1h":
              yahooInterval = "60m"
              range = "1mo"
              break
            case "2h":
              yahooInterval = "60m"
              range = "2mo"
              break
            case "4h":
              yahooInterval = "60m"
              range = "3mo"
              break
            case "6h":
              yahooInterval = "60m"
              range = "6mo"
              break
            case "8h":
              yahooInterval = "60m"
              range = "6mo"
              break
            case "12h":
              yahooInterval = "60m"
              range = "1y"
              break
            case "1d":
              yahooInterval = "1d"
              range = "2y"
              break
            case "3d":
              yahooInterval = "1d"
              range = "5y"
              break
            case "1w":
              yahooInterval = "1wk"
              range = "10y"
              break
            case "1M":
              yahooInterval = "1mo"
              range = "max"
              break
            default:
              yahooInterval = "1d"
              range = "1y"
          }

          const yahooBaseUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${stockSymbol}?interval=${yahooInterval}&range=${range}`

          const corsProxies = [
            // web.818233.xyz - primary (用户提供的代理)
            `https://web.818233.xyz/${yahooBaseUrl}`,
            // ThingProxy - secondary
            `https://thingproxy.freeboard.io/fetch/${yahooBaseUrl}`,
            // allorigins - tertiary
            `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooBaseUrl)}`,
          ]

          let response: Response | null = null
          let lastError: Error | null = null

          for (let i = 0; i < corsProxies.length; i++) {
            const proxyUrl = corsProxies[i]
            console.log(`[v0] Trying CORS proxy ${i + 1}/${corsProxies.length}: ${proxyUrl.substring(0, 50)}...`)
            try {
              response = await fetch(proxyUrl, {
                headers: {
                  Accept: "application/json",
                },
              })
              console.log(`[v0] Proxy ${i + 1} response status: ${response.status}`)
              if (response.ok) {
                console.log(`[v0] Successfully fetched stock data using proxy ${i + 1}`)
                break
              } else {
                lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
                response = null
              }
            } catch (err) {
              console.log(`[v0] Proxy ${i + 1} failed:`, err)
              lastError = err instanceof Error ? err : new Error(String(err))
              response = null
              continue
            }
          }

          if (!response) {
            console.log(`[v0] All CORS proxies failed, last error:`, lastError)
            throw lastError || new Error(`Failed to fetch stock data for ${stockSymbol}`)
          }

          const yahooData = await response.json()
          const result = yahooData.chart?.result?.[0]

          if (!result || !result.timestamp) {
            throw new Error(`No data available for ${stockSymbol}`)
          }

          const timestamps = result.timestamp
          const quote = result.indicators?.quote?.[0]

          if (!quote) {
            throw new Error(`No quote data for ${stockSymbol}`)
          }

          // Format data to match KlineData structure
          let formattedData: KlineData[] = timestamps
            .map((timestamp: number, index: number) => {
              const open = quote.open?.[index]
              const high = quote.high?.[index]
              const low = quote.low?.[index]
              const close = quote.close?.[index]
              const volume = quote.volume?.[index]

              // Skip entries with null values
              if (open == null || high == null || low == null || close == null) {
                return null
              }

              return {
                time: timestamp * 1000, // Convert to milliseconds
                open: Number(open),
                high: Number(high),
                low: Number(low),
                close: Number(close),
                volume: Number(volume || 0),
              }
            })
            .filter((item: KlineData | null): item is KlineData => item !== null)

          // Apply limit
          if (formattedData.length > limit) {
            formattedData = formattedData.slice(-limit)
          }

          // Apply endTime filter if specified
          if (endTime) {
            formattedData = formattedData.filter((item) => item.time <= endTime)
          }

          setKlineData(formattedData)
          return formattedData
        }

        // Original Binance API logic for crypto
        const endTimeParam = endTime ? `&endTime=${endTime}` : ""
        const response = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}${endTimeParam}`,
        )

        if (!response.ok) {
          throw new Error("Failed to fetch kline data")
        }

        const data = await response.json()
        const formattedData: KlineData[] = data.map((item: any) => ({
          time: item[0],
          open: Number.parseFloat(item[1]),
          high: Number.parseFloat(item[2]),
          low: Number.parseFloat(item[3]),
          close: Number.parseFloat(item[4]),
          volume: Number.parseFloat(item[5]),
        }))

        setKlineData(formattedData)
        return formattedData // Return the formatted data
      } catch (error) {
        console.error("Error fetching kline data:", error)
        toast({
          variant: "destructive",
          title: "获取K线数据失败",
          description: error instanceof Error ? error.message : "请检查交易对是否正确",
        })
        throw error // Rethrow the error so caller can handle it
      } finally {
        setIsLoadingKline(false)
      }
    },
    [toast],
  )

  const tradingPairRef = useRef(tradingPair)
  const klineIntervalRef = useRef(klineInterval)
  const klineLimitRef = useRef(klineLimit)
  const klineEndTimeRef = useRef(klineEndTime)

  useEffect(() => {
    tradingPairRef.current = tradingPair
  }, [tradingPair])

  useEffect(() => {
    klineIntervalRef.current = klineInterval
  }, [klineInterval])

  useEffect(() => {
    klineLimitRef.current = klineLimit
  }, [klineLimit])

  useEffect(() => {
    klineEndTimeRef.current = klineEndTime
  }, [klineEndTime])

  const forceReloadKlineData = useCallback(async (): Promise<KlineData[]> => {
    const currentPair = tradingPairRef.current
    const currentInterval = klineIntervalRef.current
    const currentLimit = klineLimitRef.current
    const currentEndTime = klineEndTimeRef.current

    console.log("[v0] Force reloading K-line data with current parameters:", {
      tradingPair: currentPair,
      klineInterval: currentInterval,
      klineLimit: currentLimit,
      klineEndTime: currentEndTime,
    })
    return await fetchKlineData(currentPair, currentInterval, currentLimit, currentEndTime)
  }, [fetchKlineData])

  // CHANGE: Separated useEffects for localStorage and other effects
  useEffect(() => {
    console.log("[v0] K-line chart settings effect triggered")
    // Effect to handle saving settings to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("tradingPair", tradingPair)
      localStorage.setItem("klineInterval", klineInterval)
      localStorage.setItem("klineLimit", klineLimit.toString())
      if (klineEndTime !== undefined) {
        localStorage.setItem("klineEndTime", klineEndTime.toString())
      } else {
        localStorage.removeItem("klineEndTime")
      }
    }
  }, [tradingPair, klineInterval, klineLimit, klineEndTime])

  // Main fetch effect - trigger on any dependency change
  useEffect(() => {
    console.log("[v0] K-line data fetch effect triggered:", {
      tradingPair,
      klineInterval,
      klineLimit,
      klineEndTime,
    })

    if (tradingPair && klineInterval) {
      fetchKlineData(tradingPair, klineInterval, klineLimit, klineEndTime)
    }
  }, [tradingPair, klineInterval, klineLimit, klineEndTime, fetchKlineData])

  // Format timestamp to UTC+8 ISO 8601 format (2025-12-23T07:15:00+08:00)
  const formatTimeToUTC8 = useCallback((timestamp: number): string => {
    const date = new Date(timestamp)
    // Get UTC+8 time components
    const utc8Time = new Date(date.getTime() + 8 * 60 * 60 * 1000)
    const year = utc8Time.getUTCFullYear()
    const month = String(utc8Time.getUTCMonth() + 1).padStart(2, "0")
    const day = String(utc8Time.getUTCDate()).padStart(2, "0")
    const hours = String(utc8Time.getUTCHours()).padStart(2, "0")
    const minutes = String(utc8Time.getUTCMinutes()).padStart(2, "0")
    const seconds = String(utc8Time.getUTCSeconds()).padStart(2, "0")
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`
  }, [])

  type ContextPayload = {
    tradingPair?: string
    interval?: string
    dataCount?: number
    klineData?: Array<{
      time: string
      open: number
      high: number
      low: number
      close: number
      volume: number
    }>
    indicators?: Array<{
      type: IndicatorConfig["type"]
      params: IndicatorConfig["params"]
      data: Array<Record<string, number | string>>
    }>
  }

  const formatIndicatorLabel = useCallback(
    (indicator: { type: IndicatorConfig["type"]; params: IndicatorConfig["params"] }) => {
      switch (indicator.type) {
        case "MA":
          return `MA(${indicator.params.period})`
        case "EMA":
          return `EMA(${indicator.params.period})`
        case "MACD":
          return `MACD(${indicator.params.fastPeriod},${indicator.params.slowPeriod},${indicator.params.signalPeriod})`
        case "BOLL":
          return `BOLL(${indicator.params.period},${indicator.params.stdDev})`
        case "RSI":
          return `RSI(${indicator.params.period})`
        case "KDJ":
          return `KDJ(${indicator.params.period},${indicator.params.kPeriod},${indicator.params.dPeriod})`
        case "ATR":
          return `ATR(${indicator.params.period})`
        case "MFI":
          return `MFI(${indicator.params.period})`
        case "VOL":
          return "VOL"
        case "VWAP":
          return "VWAP"
        case "OBV":
          return "OBV"
        case "VPT":
          return "VPT"
        default:
          return indicator.type
      }
    },
    [],
  )

  const buildContextJson = useCallback(
    (klineSlice: KlineData[]): string => {
      if (!klineSlice || klineSlice.length === 0) {
        return ""
      }

      const formattedKlines = klineSlice.map((item) => ({
        time: formatTimeToUTC8(item.time),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      }))

      const indicatorsPayload: Array<{
        type: IndicatorConfig["type"]
        params: IndicatorConfig["params"]
        data: Array<Record<string, number | string>>
      }> = []

      contextIndicators.forEach((indicator) => {
        const params: IndicatorConfig["params"] = indicator.params ?? {}
        let data: Array<Record<string, number | string>> = []

        switch (indicator.type) {
          case "MA":
            if (indicator.params.period) {
              data = calculateMA(klineSlice, indicator.params.period).map((item) => ({
                time: formatTimeToUTC8(item.time),
                value: item.value,
              }))
            }
            break
          case "EMA":
            if (indicator.params.period) {
              data = calculateEMA(klineSlice, indicator.params.period).map((item) => ({
                time: formatTimeToUTC8(item.time),
                value: item.value,
              }))
            }
            break
          case "MACD":
            if (indicator.params.fastPeriod && indicator.params.slowPeriod && indicator.params.signalPeriod) {
              data = calculateMACD(
                klineSlice,
                indicator.params.fastPeriod,
                indicator.params.slowPeriod,
                indicator.params.signalPeriod,
              ).map((item) => ({
                time: formatTimeToUTC8(item.time),
                macd: item.macd,
                signal: item.signal,
                histogram: item.histogram,
              }))
            }
            break
          case "BOLL":
            if (indicator.params.period && indicator.params.stdDev) {
              data = calculateBOLL(klineSlice, indicator.params.period, indicator.params.stdDev).map((item) => ({
                time: formatTimeToUTC8(item.time),
                upper: item.upper,
                middle: item.middle,
                lower: item.lower,
              }))
            }
            break
          case "RSI":
            if (indicator.params.period) {
              data = calculateRSI(klineSlice, indicator.params.period).map((item) => ({
                time: formatTimeToUTC8(item.time),
                value: item.value,
              }))
            }
            break
          case "KDJ":
            if (indicator.params.period) {
              data = calculateKDJ(
                klineSlice,
                indicator.params.period,
                indicator.params.kPeriod || 3,
                indicator.params.dPeriod || 3,
              ).map((item) => ({
                time: formatTimeToUTC8(item.time),
                k: item.k,
                d: item.d,
                j: item.j,
              }))
            }
            break
          case "ATR":
            if (indicator.params.period) {
              data = calculateATR(klineSlice, indicator.params.period).map((item) => ({
                time: formatTimeToUTC8(item.time),
                value: item.value,
              }))
            }
            break
          case "VOL":
            data = klineSlice.map((item) => ({
              time: formatTimeToUTC8(item.time),
              value: item.volume,
            }))
            break
          case "VWAP":
            data = calculateVWAP(klineSlice).map((item) => ({
              time: formatTimeToUTC8(item.time),
              value: item.value,
            }))
            break
          case "OBV":
            data = calculateOBV(klineSlice).map((item) => ({
              time: formatTimeToUTC8(item.time),
              value: item.value,
            }))
            break
          case "MFI":
            if (indicator.params.period) {
              data = calculateMFI(klineSlice, indicator.params.period).map((item) => ({
                time: formatTimeToUTC8(item.time),
                value: item.value,
              }))
            }
            break
          case "VPT":
            data = calculateVPT(klineSlice).map((item) => ({
              time: formatTimeToUTC8(item.time),
              value: item.value,
            }))
            break
        }

        if (data.length > 0) {
          indicatorsPayload.push({
            type: indicator.type,
            params,
            data,
          })
        }
      })

      const payload = {
        tradingPair,
        interval: klineInterval,
        dataCount: klineSlice.length,
        klineData: formattedKlines,
        indicators: indicatorsPayload,
      }

      return JSON.stringify(payload)
    },
    [contextIndicators, formatTimeToUTC8, tradingPair, klineInterval],
  )

  const parsedContext = useMemo<ContextPayload | null>(() => {
    if (!context) return null
    try {
      return JSON.parse(context)
    } catch {
      return null
    }
  }, [context])

  useEffect(() => {
    if (!context) {
      setContextFilter("all")
    }
  }, [context])

  useEffect(() => {
    if (contextFilter.startsWith("indicator-")) {
      const indicatorIndex = Number.parseInt(contextFilter.replace("indicator-", ""), 10)
      if (!parsedContext?.indicators || !parsedContext.indicators[indicatorIndex]) {
        setContextFilter("all")
      }
    }
  }, [contextFilter, parsedContext])

  const hasKlineData = (parsedContext?.klineData?.length ?? 0) > 0

  const baseContextFilterOptions: Array<{
    key: ContextFilter
    label: string
    disabled: boolean
  }> = [
    { key: "all", label: "全部", disabled: !context },
    { key: "kline", label: "K线", disabled: !hasKlineData },
  ]

  const indicatorFilterOptions = useMemo(
    () =>
      (parsedContext?.indicators ?? []).map((indicator, index) => ({
        key: `indicator-${index}` as IndicatorFilterKey,
        label: formatIndicatorLabel({
          type: indicator.type,
          params: indicator.params ?? {},
        }),
        disabled: !indicator.data || indicator.data.length === 0,
      })),
    [parsedContext, formatIndicatorLabel],
  )

  const filteredContext = useMemo(() => {
    if (!context) {
      return ""
    }

    if (contextFilter === "all" || !parsedContext) {
      return context
    }

    if (contextFilter === "kline") {
      const klinePayload = {
        tradingPair: parsedContext.tradingPair,
        interval: parsedContext.interval,
        dataCount: parsedContext.dataCount,
        klineData: parsedContext.klineData ?? [],
      }
      return JSON.stringify(klinePayload)
    }

    if (contextFilter.startsWith("indicator-")) {
      const indicatorIndex = Number.parseInt(contextFilter.replace("indicator-", ""), 10)
      const indicator = parsedContext.indicators?.[indicatorIndex]
      const indicatorPayload = {
        tradingPair: parsedContext.tradingPair,
        interval: parsedContext.interval,
        indicators: indicator ? [indicator] : [],
      }
      return JSON.stringify(indicatorPayload)
    }

    return context
  }, [context, contextFilter, parsedContext])

  // Handle candle click - put K-line data into user message
  const handleCandleClick = useCallback(
    (dataBeforeClick: KlineData[], clickedCandle: KlineData) => {
      const klineJson = buildContextJson(dataBeforeClick)

      setContext(klineJson)

      // Mark the clicked candle's time
      setMarkedCandleTime(clickedCandle.time)

      toast({
        title: "K线数据已填入",
        description: `已将 ${dataBeforeClick.length} 条K线数据填入上下文`,
      })
    },
    [buildContextJson, toast],
  )

  //获取当前选中的模型信息（提前定义，供 fullApiPath 使用）
  const selectedModelInfoForPath = useMemo(() => {
    if (provider === "openrouter" && model) {
      const modelIdWithoutFree = model.endsWith(":free") ? model.slice(0, -5) : model
      return openrouterModels.find((m) => m.id === modelIdWithoutFree)
    }
    if (provider === "cerebras" && model) {
      return cerebrasModels.find((m) => m.id === model)
    }
    if (provider === "modelscope" && model) {
      return modelscopeModels.find((m) => m.id === model)
    }
    return null
  }, [provider, model, openrouterModels, cerebrasModels, modelscopeModels])

  // 根据 ModelScope 的 task_types 动态选择 API 路径
  const fullApiPath = useMemo(() => {
    if (provider === "modelscope" && selectedModelInfoForPath) {
      const modelScopeInfo = selectedModelInfoForPath as ModelScopeModel
      // 如果 task_types 包含"生成图片"，使用图片生成端点
      // task_types 可能是字符串或字符串数组
      const taskTypes = modelScopeInfo.task_types
      const hasImageGeneration = Array.isArray(taskTypes)
        ? taskTypes.includes("生成图片")
        : typeof taskTypes === "string" && taskTypes.includes("生成图片")

      if (hasImageGeneration) {
        return "https://api-inference.modelscope.cn/v1/images/generations"
      } else {
        return "https://api-inference.modelscope.cn/v1/chat/completions"
      }
    }
    // 其他提供商使用统一的 baseURL + apiPath
    return `${unifiedEndpoint}${apiPath}`
  }, [provider, selectedModelInfoForPath, unifiedEndpoint, apiPath])

  useEffect(() => {
    const initializeDB = async () => {
      try {
        await initDB()
        await migrateFromLocalStorage()
        console.log("[v0] IndexedDB initialized")
      } catch (error) {
        console.error("[v0] Failed to initialize IndexedDB:", error)
      }
    }
    initializeDB()
  }, [])

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log("[v0] Loading data from storage...")

        // Load settings from localStorage (without images)
        const saved = localStorage.getItem("llm-api-test-settings")
        if (saved) {
          const settings = JSON.parse(saved)
          if (settings.provider) setProvider(settings.provider)
          if (settings.model) setModel(settings.model)
          if (settings.apiKey) setApiKey(settings.apiKey)
          if (settings.baseURL) setBaseURL(settings.baseURL)
          if (settings.apiPath) setApiPath(settings.apiPath)
          if (settings.systemPrompt !== undefined) setSystemPrompt(settings.systemPrompt)
          if (settings.userMessage !== undefined) setUserMessage(settings.userMessage)
          if (settings.promptFilePath !== undefined) setPromptFilePath(settings.promptFilePath)
          if (settings.enablePromptFile !== undefined) setEnablePromptFile(settings.enablePromptFile)
          if (settings.systemPromptFilePath !== undefined) setSystemPromptFilePath(settings.systemPromptFilePath)
          if (settings.autoReloadPrompt !== undefined) setAutoReloadPrompt(settings.autoReloadPrompt)
          if (settings.autoReloadSystemPrompt !== undefined) setAutoReloadSystemPrompt(settings.autoReloadSystemPrompt)
          if (settings.autoReloadImages !== undefined) setAutoReloadImages(settings.autoReloadImages)
          if (settings.maxTokens) setMaxTokens(settings.maxTokens)
          if (settings.temperature !== undefined) setTemperature(settings.temperature)
          if (settings.topP !== undefined) setTopP(settings.topP)
          if (settings.frequencyPenalty !== undefined) setFrequencyPenalty(settings.frequencyPenalty)
          if (settings.presencePenalty !== undefined) setPresencePenalty(settings.presencePenalty)
          if (settings.showRawColumns !== undefined) setShowRawColumns(settings.showRawColumns)
          // Load showRequestContent from settings
          if (settings.showRequestContent !== undefined) setShowRequestContent(settings.showRequestContent)
          if (settings.expandRequestContent !== undefined) setExpandRequestContent(settings.expandRequestContent)
          if (settings.expandResponseContent !== undefined) setExpandResponseContent(settings.expandResponseContent)
          if (settings.timerEnabled !== undefined) setTimerEnabled(settings.timerEnabled)
          if (settings.timerInterval !== undefined) setTimerInterval(settings.timerInterval)
          if (settings.maxTokensLimit !== undefined) setMaxTokensLimit(settings.maxTokensLimit)
          if (settings.pageSize !== undefined) setPageSize(settings.pageSize)
          if (settings.prompt !== undefined) setPrompt(settings.prompt)
          if (settings.isParametersExpanded !== undefined) setIsParametersExpanded(settings.isParametersExpanded)
          if (settings.isPromptFromLocalFile !== undefined) setIsPromptFromLocalFile(settings.isPromptFromLocalFile)
          if (settings.isSystemPromptFromLocalFile !== undefined)
            setIsSystemPromptFromLocalFile(settings.isSystemPromptFromLocalFile)
          if (settings.selectedInputModalities) setSelectedInputModalities(settings.selectedInputModalities)
          if (settings.selectedOutputModalities) setSelectedOutputModalities(settings.selectedOutputModalities)
          if (settings.modelSearchQuery !== undefined) setModelSearchQuery(settings.modelSearchQuery)
          if (settings.availableInputModalities) setAvailableInputModalities(settings.availableInputModalities)
          if (settings.availableOutputModalities) setAvailableOutputModalities(settings.availableOutputModalities)
          if (settings.imageUrl !== undefined) setImageUrl(settings.imageUrl)
          if (settings.showImageUrlInput !== undefined) setShowImageUrlInput(settings.showImageUrlInput)
          if (settings.isAddingImageUrl !== undefined) setIsAddingImageUrl(settings.isAddingImageUrl)
          // CHANGE: Load klineLimit from settings
          if (settings.klineLimit !== undefined) setKlineLimit(settings.klineLimit)
          if (settings.klineEndTime !== undefined) setKlineEndTime(settings.klineEndTime) // Added klineEndTime to settings
          // Load markdown parsing state
          if (settings.parseResponseMarkdown !== undefined) setParseResponseMarkdown(settings.parseResponseMarkdown)
          // Load marked candle time from settings
          if (settings.markedCandleTime !== undefined) setMarkedCandleTime(settings.markedCandleTime)
        }

        console.log("[v0] Loading images from IndexedDB...")
        const imagesFromDB = await loadImagesToDB() // Assuming loadImagesToDB exists
        console.log("[v0] Loaded images from IndexedDB:", imagesFromDB.length, "images")
        if (imagesFromDB.length > 0) {
          setMessageImages(imagesFromDB)
          console.log("[v0] Set messageImages state with", imagesFromDB.length, "images")
        }

        console.log("[v0] Loading history from IndexedDB...")
        const historyFromDB = await loadHistoryFromDB()
        if (historyFromDB.length > 0) {
          console.log("[v0] Loaded history from IndexedDB:", historyFromDB.length, "entries")
          setHistory(historyFromDB)
          // 异步加载响应图片
          loadResponseImagesForHistory(historyFromDB)
            .then((imagesMap) => {
              setResponseImagesMap(imagesMap)
              console.log("[v0] Loaded response images for", imagesMap.size, "history items")
            })
            .catch((error) => {
              console.error("[v0] Failed to load response images:", error)
            })
        } else {
          // Fallback to localStorage if no data in IndexedDB
          const savedHistory = localStorage.getItem("llm_api_history")
          if (savedHistory) {
            const parsedHistory = JSON.parse(savedHistory)
            setHistory(parsedHistory)
            // Save to IndexedDB for future use
            await saveHistoryToDB(parsedHistory)
          }
        }

        // Load model history from localStorage
        const savedModelHistory = localStorage.getItem("modelHistory")
        if (savedModelHistory) {
          try {
            setModelHistory(JSON.parse(savedModelHistory))
          } catch (error) {
            console.error("Failed to load model history:", error)
          }
        }
      } catch (error) {
        console.error("[v0] Error loading data:", error)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    const settings = {
      provider,
      model,
      apiKey,
      baseURL,
      apiPath,
      systemPrompt,
      userMessage,
      promptFilePath,
      enablePromptFile,
      systemPromptFilePath,
      enableSystemPromptFile,
      autoReloadPrompt,
      autoReloadSystemPrompt,
      autoReloadImages,
      maxTokens,
      temperature,
      topP,
      frequencyPenalty,
      presencePenalty,
      showRawColumns,
      // Added showRequestContent dependency
      showRequestContent,
      expandRequestContent,
      expandResponseContent,
      timerEnabled,
      timerInterval,
      maxTokensLimit,
      pageSize,
      prompt,
      isParametersExpanded,
      isPromptFromLocalFile,
      isSystemPromptFromLocalFile,
      // Changed from Set to Array to match the useState declaration
      selectedInputModalities: Array.from(selectedInputModalities), // Convert Set to Array
      selectedOutputModalities: Array.from(selectedOutputModalities), // Convert Set to Array
      modelSearchQuery,
      availableInputModalities,
      availableOutputModalities,
      imageUrl,
      showImageUrlInput,
      isAddingImageUrl,
      // CHANGE: Add klineLimit and klineEndTime to settings
      klineLimit,
      klineEndTime, // Added klineEndTime to settings
      // Add markdown parsing state to settings
      parseResponseMarkdown,
      // Add marked candle time to settings
      markedCandleTime,
    }
    localStorage.setItem("llm-api-test-settings", JSON.stringify(settings))
  }, [
    provider,
    model,
    apiKey,
    baseURL,
    apiPath,
    systemPrompt,
    userMessage,
    promptFilePath,
    enablePromptFile,
    systemPromptFilePath,
    enableSystemPromptFile,
    autoReloadPrompt,
    autoReloadSystemPrompt,
    autoReloadImages,
    maxTokens,
    temperature,
    topP,
    frequencyPenalty,
    presencePenalty,
    showRawColumns,
    // Added showRequestContent dependency
    showRequestContent,
    expandRequestContent,
    expandResponseContent,
    timerEnabled,
    timerInterval,
    maxTokensLimit,
    pageSize,
    prompt,
    isParametersExpanded,
    isPromptFromLocalFile,
    isSystemPromptFromLocalFile,
    selectedInputModalities,
    selectedOutputModalities,
    modelSearchQuery,
    availableInputModalities,
    availableOutputModalities,
    imageUrl,
    showImageUrlInput,
    isAddingImageUrl,
    klineLimit, // CHANGE: Added klineLimit dependency
    klineEndTime, // Added klineEndTime dependency
    parseResponseMarkdown, // Added parseResponseMarkdown dependency
    markedCandleTime, // Added markedCandleTime dependency
  ])

  useEffect(() => {
    if (typeof window !== "undefined" && history.length > 0) {
      saveHistoryToDB(history).catch((error) => {
        console.error("[v0] Failed to save history to IndexedDB:", error)
      })
    }
  }, [history])

  useEffect(() => {
    if (typeof window !== "undefined") {
      console.log("[v0] Saving images to IndexedDB, count:", messageImages.length)
      saveImagesToDB(messageImages).catch((error) => {
        console.error("[v0] Failed to save images to IndexedDB:", error)
      })
    }
  }, [messageImages])

  const saveToModelHistory = (status: "idle" | "success" | "error", duration: number | null) => {
    const newItem: ModelHistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      provider,
      model,
      apiKey,
      baseURL,
      apiPath,
      status,
      duration,
    }

    setModelHistory((prev) => {
      // Remove existing items with same provider, model, and apiKey
      const filtered = prev.filter(
        (item) =>
          !(item.provider === newItem.provider && item.model === newItem.model && item.apiKey === newItem.apiKey),
      )
      return [newItem, ...filtered]
    })
  }

  const readLocalFile = async (filePath: string): Promise<string | null> => {
    try {
      const response = await fetch(filePath)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const content = await response.text()
      return content
    } catch (error) {
      let errorMessage = "无法读取指定的文件路径"

      if (error instanceof TypeError && error.message.includes("fetch")) {
        errorMessage =
          "跨域访问被阻止（CORS）。请确保文件服务器支持 CORS，或使用支持 CORS 的文件托管服务（如 GitHub Gist、Pastebin 等）。"
      } else if (error instanceof Error) {
        errorMessage = error.message
      }

      toast({
        variant: "destructive",
        title: "文件读取失败",
        description: errorMessage,
      })
      return null
    }
  }

  const handleLocalFileSelect = async (type: "prompt" | "systemPrompt") => {
    console.log("[v0] handleLocalFileSelect called with type:", type)
    console.log("[v0] enablePromptFile:", enablePromptFile, "enableSystemPromptFile:", enableSystemPromptFile)

    const isInIframe = window.self !== window.top

    try {
      // Check if File System Access API is supported and not in iframe
      if ("showOpenFilePicker" in window && !isInIframe) {
        console.log("[v0] Using File System Access API")
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: "Text Files",
              accept: {
                "text/plain": [".txt"],
                "text/markdown": [".md"],
              },
            },
          ],
          multiple: false,
        })

        const file = await fileHandle.getFile()
        const content = await file.text()
        console.log("[v0] File loaded successfully:", file.name, "Content length:", content.length)

        if (type === "prompt") {
          promptFileHandleRef.current = fileHandle
          const saved = await saveFileHandle("promptFileHandle", fileHandle)
          console.log("[v0] Prompt file handle save result:", saved)
          setIsPromptFromLocalFile(true)
          setLoadedPromptContent(content)
          setPromptFilePath(file.name)
          toast({
            title: "文件加载成功",
            description: `已加载本地文件: ${file.name}`,
          })
          return content
        } else {
          systemPromptFileHandleRef.current = fileHandle
          const saved = await saveFileHandle("systemPromptFileHandle", fileHandle)
          console.log("[v0] System prompt file handle save result:", saved)
          setIsSystemPromptFromLocalFile(true)
          setLoadedSystemPromptContent(content)
          setSystemPromptFilePath(file.name)
          toast({
            title: "文件加载成功",
            description: `已加载本地文件: ${file.name}`,
          })
          return content
        }
      }
    } catch (error) {
      console.log("[v0] File System Access API failed, falling back to input method:", error)
      // Fall through to fallback method
    }

    console.log("[v0] Using fallback file input method")
    return new Promise<string | null>((resolve) => {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = ".txt,.md"
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0]
        if (file) {
          console.log("[v0] Fallback file selected:", file.name)
          const content = await file.text()
          if (type === "prompt") {
            promptFileHandleRef.current = null
            setIsPromptFromLocalFile(true)
            setLoadedPromptContent(content)
            setPromptFilePath(file.name)
            toast({
              title: "文件加载成功",
              description: `已加载本地文件: ${file.name}`,
            })
            resolve(content)
          } else {
            systemPromptFileHandleRef.current = null
            setIsSystemPromptFromLocalFile(true)
            setLoadedSystemPromptContent(content)
            setSystemPromptFilePath(file.name)
            toast({
              title: "文件加载成功",
              description: `已加载本地文件: ${file.name}`,
            })
            resolve(content)
          }
        } else {
          console.log("[v0] No file selected in fallback method")
          resolve(null)
        }
      }
      input.click()
    })
  }

  const reloadLocalFile = async (type: "prompt" | "systemPrompt"): Promise<string | null> => {
    const fileHandleRef = type === "prompt" ? promptFileHandleRef : systemPromptFileHandleRef
    const setContent = type === "prompt" ? setLoadedPromptContent : setLoadedSystemPromptContent
    const handleKey = type === "prompt" ? "promptFileHandle" : "systemPromptFileHandle"

    console.log(`[v0] reloadLocalFile called for ${type}`)
    console.log(`[v0] Current ref handle:`, fileHandleRef.current ? "exists" : "null")

    // Try to get handle from ref first, then from IndexedDB
    let handle = fileHandleRef.current
    if (!handle) {
      console.log(`[v0] Attempting to restore ${type} handle from IndexedDB`)
      handle = await getFileHandle(handleKey)
      if (handle) {
        fileHandleRef.current = handle
        console.log(`[v0] Restored ${type} file handle from IndexedDB successfully`)
      } else {
        console.log(`[v0] No ${type} handle found in IndexedDB`)
      }
    }

    // If we have a valid file handle, verify permission and use it
    if (handle) {
      console.log(`[v0] Have handle for ${type}, verifying permission...`)
      try {
        const hasPermission = await verifyFilePermission(handle)
        console.log(`[v0] Permission result for ${type}:`, hasPermission)

        if (hasPermission) {
          const file = await handle.getFile()
          const content = await file.text()
          setContent(content)
          console.log(`[v0] Reloaded ${type} from file handle with permission, content length:`, content.length)
          return content
        } else {
          console.log(`[v0] Permission denied for ${type} file handle`)
          // Just return null and let the caller handle it
        }
      } catch (error) {
        console.log(`[v0] Failed to reload from file handle:`, error)
        // File handle is no longer valid, need to re-select
        fileHandleRef.current = null
        await deleteFileHandle(handleKey)
      }
    }

    // File handle is missing or invalid, prompt user to re-select
    console.log(`[v0] File handle missing for ${type}, prompting user to re-select`)
    toast({
      title: "需要重新选择文件",
      description: "请点击确认授权文件访问，或重新选择文件。",
    })

    // Automatically open file picker
    const content = await handleLocalFileSelect(type)
    return content
  }

  const isHttpUrl = (path: string) => {
    return path.startsWith("http://") || path.startsWith("https://")
  }

  useEffect(() => {
    if (enablePromptFile && promptFilePath && isHttpUrl(promptFilePath) && !isPromptFromLocalFile) {
      readLocalFile(promptFilePath)
        .then((content) => {
          setLoadedPromptContent(content || "")
        })
        .catch((error) => {
          console.error("Failed to load prompt file:", error)
          setLoadedPromptContent("")
        })
    } else if (!enablePromptFile) {
      setLoadedPromptContent("")
      setIsPromptFromLocalFile(false)
      promptFileHandleRef.current = null
      deleteFileHandle("promptFileHandle")
    }
  }, [enablePromptFile, promptFilePath, isPromptFromLocalFile])

  useEffect(() => {
    if (
      enableSystemPromptFile &&
      systemPromptFilePath &&
      isHttpUrl(systemPromptFilePath) &&
      !isSystemPromptFromLocalFile
    ) {
      readLocalFile(systemPromptFilePath)
        .then((content) => {
          setLoadedSystemPromptContent(content || "")
        })
        .catch((error) => {
          console.error("Failed to load system prompt file:", error)
          setLoadedSystemPromptContent("")
        })
    } else if (!enableSystemPromptFile) {
      setLoadedSystemPromptContent("")
      setIsSystemPromptFromLocalFile(false)
      systemPromptFileHandleRef.current = null
      deleteFileHandle("systemPromptFileHandle")
    }
  }, [enableSystemPromptFile, systemPromptFilePath, isSystemPromptFromLocalFile])

  const handleReloadImages = async (): Promise<MessageImage[]> => {
    if (messageImages.length === 0) return messageImages

    console.log("[v0] Reloading images and clearing cache...")

    const reloadedImages: MessageImage[] = []

    for (const img of messageImages) {
      if (img.type === "url" && img.url) {
        try {
          // Add cache-busting parameter to force reload
          const urlWithCacheBust = img.url.includes("?") ? `${img.url}&_t=${Date.now()}` : `${img.url}?_t=${Date.now()}`

          const response = await fetch(urlWithCacheBust, {
            cache: "no-store", // Force no caching
          })

          if (!response.ok) {
            console.error(`[v0] Failed to reload image from ${img.url}:`, response.statusText)
            // Keep the old image if reload fails
            reloadedImages.push(img)
            continue
          }

          const blob = await response.blob()

          // Convert blob to base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (event) => resolve(event.target?.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })

          // Create updated image with new base64 data
          reloadedImages.push({
            ...img,
            base64: base64,
            mimeType: blob.type,
          })

          console.log(`[v0] Reloaded image from ${img.url}`)
        } catch (error) {
          console.error(`[v0] Error reloading image from ${img.url}:`, error)
          // Keep the old image if reload fails
          reloadedImages.push(img)
        }
      } else {
        // For file uploads, keep as-is (no URL to reload from)
        reloadedImages.push(img)
      }
    }

    setMessageImages(reloadedImages)
    console.log("[v0] Image reload complete")
    return reloadedImages
  }

  const runProbeTest = async () => {
    if (!apiKey || !model || !fullApiPath) return // Added fullApiPath check
    if (isProbeTesting) return // Prevent multiple clicks

    setIsProbeTesting(true)
    toast({
      title: "探针测试开始",
      description: `提供商: ${provider}, 模型: ${model}`,
      className: "bg-blue-50 border-blue-200",
      duration: 3000,
    })

    try {
      const startTime = performance.now()

      // 检查是否是 ModelScope 的图片生成模型
      const isModelScopeImageGeneration =
        provider === "modelscope" &&
        selectedModelInfoForPath &&
        (() => {
          const modelScopeInfo = selectedModelInfoForPath as ModelScopeModel
          const taskTypes = modelScopeInfo.task_types
          return Array.isArray(taskTypes)
            ? taskTypes.includes("生成图片")
            : typeof taskTypes === "string" && taskTypes.includes("生成图片")
        })()

      const requestBody: any = {
        model: model,
        max_tokens: 100, // Small token count for probe
        temperature: 1,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      }

      // ModelScope 图片生成模型使用 prompt 而不是 messages
      if (isModelScopeImageGeneration) {
        requestBody.prompt = "hello"
      } else {
        requestBody.messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: "hello" },
        ]
      }

      const response = await fetch(fullApiPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(10000), // 10 second timeout for probe
      })

      const duration = Math.round(performance.now() - startTime)
      setProbeDuration(duration)

      // Check if response is JSON
      const contentType = response.headers.get("content-type")
      if (!contentType?.includes("application/json")) {
        const text = await response.text()
        setProbeStatus("error")
        saveToModelHistory("error", duration)
        toast({
          variant: "destructive",
          title: "探针测试失败",
          description: `服务器返回非JSON响应 (状态码: ${response.status})`,
          duration: 3000,
        })
        setIsProbeTesting(false)
        return
      }

      const data = await response.json()

      if (response.ok && data.choices?.[0]?.message) {
        setProbeStatus("success")
        saveToModelHistory("success", duration)
        toast({
          title: "探针测试成功",
          description: `API 配置正常，响应用时: ${duration}ms`,
          className: "bg-green-50 border-green-200", // Custom styling for success toast
          duration: 3000, // 3 seconds
        })
      } else {
        setProbeStatus("error")
        saveToModelHistory("error", duration)
        toast({
          variant: "destructive",
          title: "探针测试失败",
          description: data.error?.message || "API 返回异常",
          duration: 3000, // 3 seconds
        })
      }
    } catch (error) {
      setProbeStatus("error")
      setProbeDuration(null)
      saveToModelHistory("error", null)
      toast({
        variant: "destructive",
        title: "探针测试失败",
        description: error instanceof Error ? error.message : "网络请求失败",
        duration: 3000, // 3 seconds
      })
    } finally {
      setIsProbeTesting(false)
    }
  }

  // CHANGE: Increased delay from 500ms to 5000ms (5 seconds) to prevent rapid probe firing when quickly changing settings
  useEffect(() => {
    if (apiKey && model && fullApiPath) {
      // 5 second delay to avoid triggering probe on rapid configuration changes
      const timer = setTimeout(() => {
        runProbeTest()
      }, 5000)
      return () => clearTimeout(timer)
    } else {
      setProbeStatus("idle") // Reset status if any condition is not met
    }
  }, [apiKey, model, fullApiPath]) // Dependencies for the effect

  const handleProviderChange = (providerId: string) => {
    setProvider(providerId)
    const selectedProvider = API_PROVIDERS.find((p) => p.id === providerId)
    if (selectedProvider) {
      if (selectedProvider.endpoint) {
        // For known providers, parse endpoint into baseURL and apiPath
        try {
          const url = new URL(selectedProvider.endpoint)
          setBaseURL(url.origin)
          setApiPath(url.pathname)
        } catch (e) {
          console.error("Invalid endpoint format:", selectedProvider.endpoint, e)
          setBaseURL("")
          setApiPath(selectedProvider.endpoint) // Fallback to full endpoint if URL parsing fails
        }
      } else {
        setBaseURL("")
        setApiPath("/v1/chat/completions") // Default path for custom provider
      }
    }

    if (providerId === "openrouter") {
      fetchOpenRouterModels()
    } else if (providerId === "cerebras") {
      fetchCerebrasModels()
    } else if (providerId === "modelscope") {
      fetchModelScopeModels()
      // ModelScope 使用固定的 baseURL，但 fullApiPath 会根据 task_types 动态选择
      setBaseURL("https://api-inference.modelscope.cn")
      setApiPath("/v1/chat/completions") // 默认路径，实际会根据 task_types 在 fullApiPath 中覆盖
    }
  }

  const fetchCerebrasModels = async () => {
    setIsLoadingModels(true)
    try {
      // 从提供的 URL 获取模型信息
      const response = await fetch("https://models.xiechengqi.top/cerebras.json")
      if (response.ok) {
        const responseData = await response.json()
        console.log("[v0] Fetched Cerebras models:", responseData)
        // 根据结构，数据可能在 models 字段中
        const models = Array.isArray(responseData) ? responseData : responseData.models || responseData.data || []
        setCerebrasModels(models)
      } else {
        console.error("[v0] Failed to fetch Cerebras models:", response.statusText)
        setCerebrasModels([])
      }
    } catch (error) {
      console.error("[v0] Error fetching Cerebras models:", error)
      setCerebrasModels([])
    } finally {
      setIsLoadingModels(false)
    }
  }

  const fetchModelScopeModels = async () => {
    setIsLoadingModels(true)
    try {
      // 从提供的 URL 获取模型信息
      const response = await fetch("https://models.xiechengqi.top/modelscope.json")
      if (response.ok) {
        const responseData = await response.json()
        console.log("[v0] Fetched ModelScope models:", responseData)
        // 根据结构，数据可能在 models 字段中
        const models = Array.isArray(responseData) ? responseData : responseData.models || responseData.data || []
        setModelscopeModels(models)
      } else {
        console.error("[v0] Failed to fetch ModelScope models:", response.statusText)
        setModelscopeModels([])
      }
    } catch (error) {
      console.error("[v0] Error fetching ModelScope models:", error)
      setModelscopeModels([])
    } finally {
      setIsLoadingModels(false)
    }
  }

  const fetchOpenRouterModels = async () => {
    setIsLoadingModels(true)
    try {
      // 从提供的 URL 获取模型信息
      const response = await fetch("https://models.xiechengqi.top/openrouter.json")
      if (response.ok) {
        const responseData = await response.json()
        console.log("[v0] Fetched OpenRouter models:", responseData)
        // 根据 demos/openrouter.json 结构，数据在 models 字段中
        const models = Array.isArray(responseData) ? responseData : responseData.models || responseData.data || []
        setOpenrouterModels(models)
      } else {
        console.error("[v0] Failed to fetch OpenRouter models:", response.statusText)
        setOpenrouterModels([])
      }
    } catch (error) {
      console.error("[v0] Error fetching OpenRouter models:", error)
      setOpenrouterModels([])
    } finally {
      setIsLoadingModels(false)
    }
  }

  useEffect(() => {
    if (provider === "openrouter") {
      fetchOpenRouterModels()
    } else if (provider === "cerebras") {
      fetchCerebrasModels()
    } else if (provider === "modelscope") {
      fetchModelScopeModels()
    } else {
      // Clear available modalities when switching away from OpenRouter
      setAvailableInputModalities([])
      setAvailableOutputModalities([])
    }
  }, [provider])

  const handleTest = async (messageOverride?: string, contextOverride?: string) => {
    // if (loading) return // Prevent multiple simultaneous tests
    console.log("[v0] handleTest called, loading:", loading)

    setLoading(true)
    setError("")
    setRequestData("")
    setResponseData("")
    setResponseDuration(null)
    abortControllerRef.current = new AbortController()

    // CHANGE: Store reloaded images in a variable to use in the API request
    let currentImages = messageImages

    if (autoReloadImages && messageImages.some((img) => img.type === "url")) {
      console.log("[v0] Auto-reloading images before test...")

      const reloadToast = toast({
        title: "正在重载图片",
        description: `正在重新加载 ${messageImages.filter((img) => img.type === "url").length} 张图片...`,
        duration: Number.POSITIVE_INFINITY, // Never auto-dismiss
      })

      currentImages = await handleReloadImages()

      reloadToast.dismiss()
      toast({
        title: "图片重载完成",
        description: "所有图片已更新，开始测试...",
        className: "bg-green-50 border-green-200",
        duration: 2000,
      })
    }

    if (!apiKey) {
      setError("Please provide an API key")
      toast({
        variant: "destructive",
        title: "错误",
        description: "请提供 API Key",
      })
      setLoading(false) // Ensure loading is set to false on error
      return
    }

    const modelToUse = model || DEFAULT_VALUES.model

    console.log("[v0] enablePromptFile:", enablePromptFile)
    console.log("[v0] autoReloadPrompt:", autoReloadPrompt)
    console.log("[v0] isPromptFromLocalFile:", isPromptFromLocalFile)
    console.log("[v0] promptFileHandleRef.current:", promptFileHandleRef.current)
    console.log("[v0] promptFilePath:", promptFilePath)

    // Handle external system prompt loading
    let finalSystemPrompt = systemPrompt

    if (enableSystemPromptFile && systemPromptFilePath.trim()) {
      console.log("[v0] System prompt external loading enabled")

      if (autoReloadSystemPrompt) {
        console.log("[v0] Auto reload system prompt is ON")
        // Always reload when auto-reload is enabled
        const isHttpUrl =
          systemPromptFilePath.trim().startsWith("http://") || systemPromptFilePath.trim().startsWith("https://")

        if (isHttpUrl) {
          console.log("[v0] Reloading system prompt from HTTP URL")
          const reloadedContent = await readLocalFile(systemPromptFilePath.trim())
          if (reloadedContent !== null) {
            // Check for null explicitly
            setLoadedSystemPromptContent(reloadedContent)
            finalSystemPrompt = reloadedContent
            console.log("[v0] Reloaded system prompt from URL, length:", reloadedContent.length)
          } else {
            // If reload failed, use existing loaded content or default
            finalSystemPrompt = loadedSystemPromptContent || systemPrompt
          }
        } else if (isSystemPromptFromLocalFile) {
          console.log("[v0] Reloading system prompt from local file")
          const reloadedContent = await reloadLocalFile("systemPrompt")
          if (reloadedContent !== null) {
            // Check for null explicitly
            finalSystemPrompt = reloadedContent
            console.log("[v0] Reloaded system prompt from local file, length:", reloadedContent.length)
          } else {
            // User cancelled file selection, use existing content
            finalSystemPrompt = loadedSystemPromptContent || systemPrompt
          }
        } else {
          finalSystemPrompt = loadedSystemPromptContent || systemPrompt
        }
      } else {
        // Auto-reload is OFF, use cached content
        console.log("[v0] Using cached system prompt content")
        finalSystemPrompt = loadedSystemPromptContent || systemPrompt
      }
    }

    console.log("[v0] Final system prompt length:", finalSystemPrompt.length)

    // Handle external user message loading
    console.log("[v0] enablePromptFile:", enablePromptFile)
    console.log("[v0] autoReloadPrompt:", autoReloadPrompt)
    console.log("[v0] isPromptFromLocalFile:", isPromptFromLocalFile)
    console.log("[v0] promptFileHandleRef.current:", promptFileHandleRef.current)
    console.log("[v0] promptFilePath:", promptFilePath)

    let finalUserMessage = messageOverride !== undefined ? messageOverride : userMessage

    if (enablePromptFile && promptFilePath.trim()) {
      console.log("[v0] User message external loading enabled")

      if (autoReloadPrompt) {
        console.log("[v0] Auto reload prompt is ON")
        // Always reload when auto-reload is enabled
        const isHttpUrl = promptFilePath.trim().startsWith("http://") || promptFilePath.trim().startsWith("https://")

        if (isHttpUrl) {
          console.log("[v0] Reloading user message from HTTP URL")
          const reloadedContent = await readLocalFile(promptFilePath.trim())
          if (reloadedContent !== null) {
            // Check for null explicitly
            setLoadedPromptContent(reloadedContent)
            finalUserMessage = reloadedContent
            console.log("[v0] Reloaded user message from URL, length:", reloadedContent.length)
          } else {
            // If reload failed, use existing loaded content or default
            finalUserMessage = loadedPromptContent || userMessage
          }
        } else if (isPromptFromLocalFile) {
          console.log("[v0] Reloading user message from local file")
          const reloadedContent = await reloadLocalFile("prompt")
          if (reloadedContent !== null) {
            // Check for null explicitly
            finalUserMessage = reloadedContent
            console.log("[v0] Reloaded user message from local file, length:", reloadedContent.length)
          } else {
            // User cancelled file selection, use existing content
            finalUserMessage = loadedPromptContent || userMessage
          }
        } else {
          finalUserMessage = loadedPromptContent || userMessage
        }
      } else {
        // Auto-reload is OFF, use cached content
        console.log("[v0] Using cached user message content")
        finalUserMessage = loadedPromptContent || userMessage
      }
    }

    console.log("[v0] Final user message length:", finalUserMessage.length)

    // Use contextOverride if provided (for immediate context updates without waiting for state)
    const effectiveContext = contextOverride !== undefined ? contextOverride : context

    // Compress context JSON to single line to save tokens
    let compressedContext = effectiveContext
    if (effectiveContext && effectiveContext.trim()) {
      try {
        // Try to parse and stringify JSON to compress it (remove formatting)
        const trimmedContext = effectiveContext.trim()
        const parsed = JSON.parse(trimmedContext)
        // Use JSON.stringify without formatting parameters to compress to single line
        compressedContext = JSON.stringify(parsed)
        console.log(
          "[v0] Context compressed successfully. Original length:",
          trimmedContext.length,
          "Compressed length:",
          compressedContext.length,
        )
        console.log("[v0] Compressed context preview:", compressedContext.substring(0, 150))
      } catch (error) {
        // If not valid JSON, use context as is
        console.log("[v0] Context is not valid JSON, error:", error)
        console.log("[v0] Context preview:", effectiveContext.substring(0, 150))
        compressedContext = effectiveContext
      }
    }

    // Merge context and user message
    const combinedMessage = compressedContext ? `${compressedContext}\n\n${finalUserMessage}` : finalUserMessage

    // Debug: Log combined message to verify compression
    if (compressedContext && compressedContext !== context) {
      console.log(
        "[v0] Context was compressed. Original length:",
        context.length,
        "Compressed length:",
        compressedContext.length,
      )
      console.log("[v0] Compressed context preview:", compressedContext.substring(0, 200))
    }

    // Prepare the user message content based on whether there are images
    const userContent: Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }> =
      currentImages.length > 0
        ? [
            {
              type: "text",
              text: combinedMessage,
            },
            ...currentImages.map((img) => ({
              type: "image_url" as const,
              image_url: { url: img.url }, // Use img.url directly from currentImages
            })),
          ]
        : [
            {
              type: "text",
              text: combinedMessage,
            },
          ]

    // The rest of the requestBody preparation will use `userContent`
    const messages: any[] = [
      { role: "user", content: userContent }, // Use prepared userContent
      { role: "system", content: finalSystemPrompt },
    ]

    const modelScopeImageGeneration =
      provider === "modelscope" &&
      selectedModelInfoForPath &&
      (() => {
        const modelScopeInfo = selectedModelInfoForPath as ModelScopeModel
        const taskTypes = modelScopeInfo.task_types
        return Array.isArray(taskTypes)
          ? taskTypes.includes("生成图片")
          : typeof taskTypes === "string" && taskTypes.includes("生成图片")
      })()

    const requestBody: any = {
      model: modelToUse,
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      stream: stream, // Include stream parameter
    }

    // ModelScope 图片生成模型使用 prompt 而不是 messages
    if (modelScopeImageGeneration) {
      requestBody.prompt = finalUserMessage // For image generation, use the text message as prompt
    } else {
      requestBody.messages = messages
    }

    console.log("[v0] Generating request with user message length:", finalUserMessage.length)

    // Generate cURL command, handling potential undefined values for headers
    const curlHeaders = ["Content-Type: application/json", `Authorization: Bearer ${apiKey}`]
    if (baseURL && provider === "custom") {
      // Example for custom header, adjust as needed for other providers if they require different headers
      // For OpenAI, Anthropic, etc., Authorization is usually enough.
      // For some custom setups, an additional API key might be needed.
      // curlHeaders.push(`X-Custom-Auth: ${apiKey}`)
    }

    const requestCurl = `curl ${fullApiPath} \\
  -X POST \\
  ${curlHeaders.map((h) => `-H "${h}" \\`).join("\n  ")}
  -d '${JSON.stringify(requestBody, null, 2).replace(/\n/g, "\n  ")}'`

    setRequestData(requestCurl)
    console.log("[v0] Request curl generated, length:", requestCurl.length)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, 60000) // 60 second timeout

    try {
      console.log("[v0] Sending request to:", fullApiPath)
      const startTime = performance.now() // Track start time

      const response = await fetch(fullApiPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      })

      clearTimeout(timeoutId)

      const endTime = performance.now() // Track end time
      const duration = Math.round(endTime - startTime) // Calculate duration
      setResponseDuration(duration) // Set response duration state

      const responseText = await response.text()
      let parsedResponse
      try {
        parsedResponse = JSON.parse(responseText)
      } catch {
        parsedResponse = responseText
      }

      const formattedResponse = JSON.stringify(
        {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: parsedResponse,
        },
        null,
        2,
      )
      setResponseData(formattedResponse)

      const requestContent = JSON.stringify(messages) // Store the actual messages array

      let responseContent = ""
      let responseImagesToSave: MessageImage[] = []

      // Check for ModelScope image generation format: images[0].url
      // parsedResponse 是 API 直接返回的内容，所以检查 parsedResponse.images
      const modelScopeImages = parsedResponse?.images
      if (modelScopeImages && Array.isArray(modelScopeImages) && modelScopeImages.length > 0) {
        // ModelScope 图片生成响应：直接使用图片 URL（避免 CORS 问题）
        const imageUrls = modelScopeImages
          .map((img: any) => img.url)
          .filter((url: any) => url && (url.startsWith("http://") || url.startsWith("https://")))

        if (imageUrls.length > 0) {
          // 直接使用图片 URL，不进行下载转换（避免 CORS 错误）
          const timestamp = Date.now()
          responseImagesToSave = imageUrls.map((url, idx) => ({
            id: `response-${timestamp}-${idx}`,
            type: "url" as const,
            url: url,
          }))
          // 使用图片 URL 作为响应内容
          responseContent = imageUrls.join("\n")
        } else {
          responseContent = JSON.stringify(parsedResponse)
        }
      } else {
        const messageContent = parsedResponse?.choices?.[0]?.message?.content
        const anthropicContent = parsedResponse?.content?.[0]?.text

        if (messageContent || parsedResponse?.choices?.[0]?.message) {
          // Check for reasoning_details (new format for deep thinking models like OLMo, DeepSeek R1, etc.)
          const reasoningDetails = parsedResponse?.choices?.[0]?.message?.reasoning_details?.[0]?.text
          const reasoningContent =
            parsedResponse?.choices?.[0]?.message?.reasoning_content || parsedResponse?.choices?.[0]?.message?.reasoning

          if (reasoningDetails) {
            // New format: reasoning_details array with text field
            if (messageContent) {
              responseContent = `<Thinking>\n${reasoningDetails}\n</Thinking>\n\n${messageContent}`
            } else {
              // If content is empty, just use the reasoning
              responseContent = reasoningDetails
            }
          } else if (reasoningContent) {
            // Legacy format: reasoning_content or reasoning field
            if (messageContent) {
              responseContent = `<Thinking>\n${reasoningContent}\n</Thinking>\n\n${messageContent}`
            } else {
              responseContent = reasoningContent
            }
          } else if (messageContent) {
            // Regular content without separate reasoning
            responseContent = messageContent
          } else {
            // Fallback to full message object
            responseContent = JSON.stringify(parsedResponse?.choices?.[0]?.message)
          }
        } else if (anthropicContent) {
          responseContent = anthropicContent
        } else {
          responseContent = JSON.stringify(parsedResponse)
        }
      }

      const historyTimestamp = Date.now()
      const contextTags: string[] = []
      try {
        const parsedContext = JSON.parse(compressedContext || effectiveContext || "null")
        if (parsedContext && typeof parsedContext === "object") {
          if (parsedContext.klineData && Array.isArray(parsedContext.klineData) && parsedContext.klineData.length > 0) {
            contextTags.push("K线")
          }
          if (parsedContext.indicators && Array.isArray(parsedContext.indicators)) {
            parsedContext.indicators.forEach((indicator: any) => {
              const type = indicator?.type
              const params = indicator?.params || {}
              switch (type) {
                case "MA":
                case "EMA":
                  contextTags.push(`${type}(${params.period ?? "?"})`)
                  break
                case "MACD":
                  contextTags.push(
                    `MACD(${params.fastPeriod ?? "?"},${params.slowPeriod ?? "?"},${params.signalPeriod ?? "?"})`,
                  )
                  break
                case "BOLL":
                  contextTags.push(`BOLL(${params.period ?? "?"},${params.stdDev ?? "?"})`)
                  break
                case "KDJ":
                  contextTags.push(`KDJ(${params.period ?? "?"},${params.kPeriod ?? "?"},${params.dPeriod ?? "?"})`)
                  break
                case "ATR":
                case "RSI":
                case "MFI":
                  contextTags.push(`${type}(${params.period ?? "?"})`)
                  break
                case "VOL":
                case "VWAP":
                case "OBV":
                case "VPT":
                  contextTags.push(type)
                  break
                default:
                  if (typeof type === "string") {
                    contextTags.push(type)
                  }
                  break
              }
            })
          }
        }
      } catch (err) {
        console.warn("[v0] Failed to parse context for tags:", err)
      }

      const historyItem: HistoryItem = {
        id: historyTimestamp.toString(),
        timestamp: historyTimestamp,
        model: modelToUse, // Use the actual model used
        tradingPair,
        requestContent,
        requestRaw: requestCurl,
        responseContent,
        responseRaw: formattedResponse,
        duration: duration, // Store response time
        contextTags,
      }

      // 保存响应图片到 IndexedDB（如果存在）
      if (responseImagesToSave.length > 0) {
        saveResponseImagesToDB(historyTimestamp, responseImagesToSave)
          .then(() => {
            // 更新状态中的图片映射
            const base64Images = responseImagesToSave.map((img) => img.base64 || img.url || "").filter(Boolean)
            if (base64Images.length > 0) {
              setResponseImagesMap((prev) => {
                const newMap = new Map(prev)
                newMap.set(historyTimestamp, base64Images)
                return newMap
              })
            }
          })
          .catch((error) => {
            console.error("[v0] Failed to save response images to IndexedDB:", error)
          })
      }

      setHistory((prev) => {
        const updated = [historyItem, ...prev]
        // Save to IndexedDB instead of localStorage
        saveHistoryToDB(updated).catch((error) => {
          console.error("[v0] Failed to save history to IndexedDB:", error)
        })
        return updated
      })

      if (!response.ok) {
        const errorMsg = `API Error: ${response.status} - ${parsedResponse.error?.message || response.statusText}`
        setError(errorMsg)
        toast({
          variant: "destructive",
          title: "请求失败",
          description: `状态码 ${response.status}: ${parsedResponse.error?.message || response.statusText}`,
        })
      } else {
        toast({
          title: "请求成功",
          description: `API 响应状态: ${response.status}`,
        })
      }
    } catch (error: any) {
      // Changed to any to access error.name and error.message
      clearTimeout(timeoutId)
      console.error("[v0] Error during test:", error)

      if (error.name === "AbortError") {
        setError("测试已中断")
        toast({
          title: "测试已中断",
          description: "测试已被用户中断",
          duration: 2000,
        })
      } else if (error.message.includes("API key")) {
        setError(error.message)
        toast({
          variant: "destructive",
          title: "错误",
          description: error.message,
        })
      } else {
        setError(error.message || "An error occurred")
        toast({
          variant: "destructive",
          title: "错误",
          description: error.message || "发生未知错误",
        })
      }

      const errorResponse = JSON.stringify({ error: error.message || "Unknown error" })
      setResponseData(errorResponse)
      setResponseDuration(null) // Reset duration on error

      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        model: modelToUse, // Add model to history item
        tradingPair,
        requestContent: "",
        requestRaw: "",
        responseContent: "",
        responseRaw: errorResponse,
        duration: null, // Duration is not applicable on error
        contextTags: [],
      }
      setHistory((prev) => {
        const updated = [newHistoryItem, ...prev]
        // Save to IndexedDB instead of localStorage
        saveHistoryToDB(updated).catch((error) => {
          console.error("[v0] Failed to save history to IndexedDB:", error)
        })
        return updated
      })
    } finally {
      setLoading(false)
      abortControllerRef.current = null

      // Schedule next test after response returns (if timer is running)
      if (isTimerRunningRef.current) {
        scheduleNextTest()
      }
    }
  }

  // Schedule next test after response returns
  const scheduleNextTest = async () => {
    // Check if timer is still running (use ref for immediate check)
    if (!isTimerRunningRef.current) {
      return
    }

    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // Schedule next test after timerInterval seconds
    timerRef.current = setTimeout(async () => {
      // Check if timer is still running (user might have stopped it)
      if (!isTimerRunningRef.current) {
        return
      }

      // Check if there's a selected candle
      if (markedCandleTime === null) {
        // No selected candle, reload K-line data before test
        console.log("[v0] Timer tick: No selected candle, reloading K-line data...")
        try {
          const loadedData = await forceReloadKlineData()

          if (loadedData && loadedData.length > 0) {
            const klineDataText = buildContextJson(loadedData)

            // Update state for UI display
            if (klineDataText) {
              setContext(klineDataText)
              console.log("[v0] Timer tick: Updated user message with fresh K-line data")
            }

            // Execute the test with the new context directly (not relying on state update)
            // handleTest will call scheduleNextTest again after response returns
            handleTest(undefined, klineDataText)
          } else {
            // If no data loaded, use current message
            handleTest()
          }
        } catch (error) {
          console.error("[v0] Timer tick: Error reloading K-line data:", error)
          // On error, still execute test with current message
          handleTest()
        }
      } else {
        console.log("[v0] Timer tick: Selected candle exists, using existing message")
        // Execute the test with current message
        handleTest()
      }
    }, timerInterval * 1000) // Convert seconds to milliseconds
  }

  const startTimer = (initialMessage?: string, initialContext?: string) => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    isTimerRunningRef.current = true
    setIsTimerRunning(true)

    // Execute handleTest immediately for the first time with initial message/context if provided
    // handleTest will call scheduleNextTest after response returns
    handleTest(initialMessage, initialContext)
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    isTimerRunningRef.current = false
    setIsTimerRunning(false)
  }

  const handleInterruptTest = () => {
    console.log("[v0] handleInterruptTest called")
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setLoading(false)
      abortControllerRef.current = null
      toast({
        title: "测试已中断",
        description: "测试已被用户中断",
        duration: 2000,
      })
    }
  }

  // Combine test and timer start logic
  const handleStartTest = async () => {
    // <-- Modified to be async
    console.log("[v0] handleStartTest called, checking for selected candle...")

    if (markedCandleTime !== null) {
      // If candle is selected, do nothing - just proceed with existing message
      console.log("[v0] Selected candle exists, proceeding without reload")
    } else {
      // If no candle selected, clear context, reload chart, and write all K-line data
      console.log("[v0] No selected candle, clearing context and reloading K-line data...")

      // Clear context only (preserve user message)
      setContext("")

      // Show toast notification that reload is starting
      toast({
        title: "正在重载K线数据",
        description: "请稍等...",
        duration: 2000,
      })

      try {
        const loadedData = await forceReloadKlineData()

        console.log("[v0] K-line data reload completed, data length:", loadedData?.length || 0)

        if (loadedData && loadedData.length > 0) {
          const klineDataText = buildContextJson(loadedData)

          setContext(klineDataText)
          console.log("[v0] Overwrote user message with K-line data, length:", klineDataText.length)

          toast({
            title: "K线数据已添加",
            description: `已将 ${loadedData.length} 条K线数据添加到上下文中`,
            className: "bg-green-50 border-green-200",
            duration: 2000,
          })

          if (timerEnabled) {
            startTimer(undefined, klineDataText)
          } else {
            handleTest(undefined, klineDataText)
          }
          return // Return early since we've already called handleTest
        } else {
          toast({
            variant: "destructive",
            title: "K线数据为空",
            description: "无法获取K线数据，请检查参数设置",
          })
          return
        }
      } catch (error) {
        console.error("[v0] Error reloading K-line data:", error)
        toast({
          variant: "destructive",
          title: "K线数据加载失败",
          description: "请重试或检查网络连接",
        })
        return
      }
    }

    if (timerEnabled) {
      startTimer()
    } else {
      handleTest()
    }
  }

  const handleResetApiConfig = () => {
    setProvider(DEFAULT_VALUES.provider)
    setBaseURL(DEFAULT_VALUES.baseURL)
    setApiPath(DEFAULT_VALUES.apiPath)
    setApiKey("")
    setModel("")
    setError("")
    setShowApiKey(false) // Reset API Key visibility
    setProbeStatus("idle") // Reset probe status
    setSystemPrompt(DEFAULT_VALUES.systemPrompt) // Reset systemPrompt
    setUserMessage(DEFAULT_VALUES.userMessage) // Reset userMessage
    setContext("") // Reset context
    setIsContextExpanded(false) // Reset context expanded state
    setPromptFilePath(DEFAULT_VALUES.promptFilePath) // Reset promptFilePath
    setEnablePromptFile(DEFAULT_VALUES.enablePromptFile) // Reset enablePromptFile
    // Resetting system prompt external file settings
    setSystemPromptFilePath(DEFAULT_VALUES.systemPromptFilePath)
    setEnableSystemPromptFile(DEFAULT_VALUES.enableSystemPromptFile)
    setLoadedSystemPromptContent("") // Clear loaded content

    // Reset local file states
    setIsPromptFromLocalFile(false)
    promptFileHandleRef.current = null
    setIsSystemPromptFromLocalFile(false)
    systemPromptFileHandleRef.current = null

    // Delete file handles from IndexedDB on reset
    deleteFileHandle("promptFileHandle")
    deleteFileHandle("systemPromptFileHandle")

    // Reset modality filters and search query
    setSelectedInputModalities([]) // Reset to empty array
    setSelectedOutputModalities([]) // Reset to empty array
    setModelSearchQuery("")

    // Reset available modalities
    setAvailableInputModalities([])
    setAvailableOutputModalities([])

    // Reset image-related state
    setMessageImages([])
    setImageUrl("")
    setShowImageUrlInput(false)
    setIsAddingImageUrl(false)
    setAutoReloadImages(DEFAULT_VALUES.autoReloadImages) // Reset autoReloadImages

    // Reset K-line states
    setKlineData([])
    setKlineEndTime(undefined) // Reset endTime
    setKlineLimit(100) // Reset klineLimit
    setMarkedCandleTime(null) // Reset marked candle time

    // Remove specific items from localStorage
    localStorage.removeItem("llm-api-test-settings") // Clear all settings and reload defaults
  }

  const handleResetParameters = () => {
    setPrompt(DEFAULT_VALUES.prompt) // This seems to reset the old prompt state, consider if userMessage is preferred
    setMaxTokens(DEFAULT_VALUES.maxTokens)
    setTemperature(DEFAULT_VALUES.temperature)
    setTopP(DEFAULT_VALUES.topP)
    setFrequencyPenalty(DEFAULT_VALUES.frequencyPenalty)
    setPresencePenalty(DEFAULT_VALUES.presencePenalty)
    setStream(false) // Reset stream
    // Reset timer settings and stop timer if running
    setTimerEnabled(DEFAULT_VALUES.timerEnabled)
    setTimerInterval(DEFAULT_VALUES.timerInterval)
    stopTimer() // Ensure timer is stopped on reset
    setShowRawColumns(DEFAULT_VALUES.showRawColumns) // Reset showRawColumns
    // Reset separate expand states
    setExpandRequestContent(DEFAULT_VALUES.expandRequestContent)
    setExpandResponseContent(DEFAULT_VALUES.expandResponseContent)
    setSystemPrompt(DEFAULT_VALUES.systemPrompt) // Reset system prompt
    setUserMessage(DEFAULT_VALUES.userMessage) // Reset user message
    setPromptFilePath(DEFAULT_VALUES.promptFilePath) // Reset promptFilePath
    setEnablePromptFile(DEFAULT_VALUES.enablePromptFile) // Reset enablePromptFile

    // Reset auto reload settings
    setAutoReloadPrompt(DEFAULT_VALUES.autoReloadPrompt)
    setAutoReloadSystemPrompt(DEFAULT_VALUES.autoReloadSystemPrompt)
    setAutoReloadImages(DEFAULT_VALUES.autoReloadImages) // Reset autoReloadImages

    setMessageImages([])
    setImageUrl("")
    setShowImageUrlInput(false)
    setIsAddingImageUrl(false)

    // Reset K-line states
    setKlineData([])
    setKlineEndTime(undefined) // Reset endTime
    setKlineLimit(100) // Reset klineLimit
    setMarkedCandleTime(null) // Reset marked candle time

    // Remove specific items from localStorage
    localStorage.removeItem("llm-api-test-settings") // Clear all settings and reload defaults
  }

  const handleReset = () => {
    handleResetApiConfig()
    handleResetParameters()
  }

  const handleDeleteAllHistory = () => {
    clearAllData()
      .then(() => {
        setHistory([])
        toast({
          title: "历史记录已清空",
          description: "所有历史测试数据已被删除",
        })
      })
      .catch((error) => {
        console.error("[v0] Failed to clear all data:", error)
        toast({
          variant: "destructive",
          title: "错误",
          description: "清空历史记录失败",
        })
      })
  }

  const handleDeleteHistoryItem = (id: string) => {
    const itemToDelete = history.find((item) => item.id === id)
    const updated = history.filter((item) => item.id !== id)
    setHistory(updated)

    // 删除对应的响应图片
    if (itemToDelete) {
      deleteResponseImagesFromDB(itemToDelete.timestamp).catch((error) => {
        console.error("[v0] Failed to delete response images:", error)
      })
      // 从状态中移除
      setResponseImagesMap((prev) => {
        const newMap = new Map(prev)
        newMap.delete(itemToDelete.timestamp)
        return newMap
      })
    }

    saveHistoryToDB(updated).catch((error) => {
      console.error("[v0] Failed to update history in IndexedDB:", error)
    })
    toast({
      title: "记录已删除",
      description: "历史记录项已被删除",
    })
  }

  const handleClearHistory = () => {
    setHistory([])
    setResponseImagesMap(new Map()) // 清空响应图片映射
    clearAllData().catch((error) => {
      console.error("[v0] Failed to clear IndexedDB:", error)
    })
    setCurrentPage(1) // Reset to first page after clearing
    toast({
      title: "历史记录已清空",
      description: "所有历史测试数据已被删除",
    })
  }

  const deleteModelHistoryItem = (id: string) => {
    setModelHistory((prev) => prev.filter((item) => item.id !== id))
    toast({
      title: "记录已删除",
      duration: 2000,
    })
  }

  const toggleApiKeyVisibility = (itemId: string) => {
    setVisibleApiKeys((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  const runHistoryProbeTest = async (item: ModelHistoryItem) => {
    if (!item.apiKey || !item.model) return

    const fullPath = item.baseURL ? `${item.baseURL}${item.apiPath}` : item.apiPath

    toast({
      title: "探针测试开始",
      description: `提供商: ${item.provider}, 模型: ${item.model}`,
      className: "bg-blue-50 border-blue-200",
      duration: 3000,
    })

    try {
      const startTime = performance.now()

      const requestBody = {
        model: item.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "hello" },
        ],
        max_tokens: 100,
        temperature: 1,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      }

      const response = await fetch(fullPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${item.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(10000),
      })

      const duration = Math.round(performance.now() - startTime)

      const contentType = response.headers.get("content-type")
      if (!contentType?.includes("application/json")) {
        setModelHistory((prev) =>
          prev.map((h) => (h.id === item.id ? { ...h, status: "error" as const, duration } : h)),
        )
        toast({
          variant: "destructive",
          title: "探针测试失败",
          description: `服务器返回非JSON响应 (状态码: ${response.status})`,
          duration: 3000,
        })
        return
      }

      const data = await response.json()

      if (response.ok && data.choices?.[0]?.message) {
        setModelHistory((prev) =>
          prev.map((h) => (h.id === item.id ? { ...h, status: "success" as const, duration } : h)),
        )
        toast({
          title: "探针测试成功",
          description: `API 配置正常，响应用时: ${duration}ms`,
          className: "bg-green-50 border-green-200",
          duration: 3000,
        })
      } else {
        setModelHistory((prev) =>
          prev.map((h) => (h.id === item.id ? { ...h, status: "error" as const, duration } : h)),
        )
        toast({
          variant: "destructive",
          title: "探针测试失败",
          description: data.error?.message || "API 返回异常",
          duration: 3000,
        })
      }
    } catch (error) {
      setModelHistory((prev) =>
        prev.map((h) => (h.id === item.id ? { ...h, status: "error" as const, duration: null } : h)),
      )
      toast({
        variant: "destructive",
        title: "探针测试失败",
        description: error instanceof Error ? error.message : "未知错误",
        duration: 3000,
      })
    }
  }

  const exportHistoryToCSV = () => {
    if (history.length === 0) return

    // Define CSV headers based on showRawColumns state
    const headers = (() => {
      const baseHeaders = ["时间", "模型", "用时(ms)"]
      if (showRequestContent) baseHeaders.push("请求 Content")
      if (showRawColumns) baseHeaders.push("请求 Raw")
      baseHeaders.push("响应 Content")
      if (showRawColumns) baseHeaders.push("响应 Raw")
      return headers
    })()

    // Convert history data to CSV rows
    const rows = history.map((item) => {
      const timestamp = new Date(item.timestamp).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
      const duration = item.duration !== undefined && item.duration !== null ? item.duration : "-"

      // Escape double quotes and wrap fields in quotes
      const escapeCSV = (text: string) => {
        if (text === null || text === undefined) return '""'
        return `"${String(text).replace(/"/g, '""')}"`
      }

      const rowData = [escapeCSV(timestamp), escapeCSV(item.model), escapeCSV(String(duration))]
      if (showRequestContent) rowData.push(escapeCSV(item.requestContent))
      if (showRawColumns) rowData.push(escapeCSV(item.requestRaw))
      rowData.push(escapeCSV(item.responseContent))
      if (showRawColumns) rowData.push(escapeCSV(item.responseRaw))

      return rowData.join(",")
    })

    // Combine headers and rows
    const csv = [headers.join(","), ...rows].join("\n")

    // Create blob and download
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `llm_api_history_${Date.now()}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const toggleCellExpansion = (cellId: string) => {
    setExpandedCells((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(cellId)) {
        newSet.delete(cellId)
      } else {
        newSet.add(cellId)
      }
      return newSet
    })
  }

  const toggleRawVisibility = (cellId: string) => {
    setVisibleRawCells((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(cellId)) {
        newSet.delete(cellId)
      } else {
        newSet.add(cellId)
      }
      return newSet
    })
  }

  const totalPages = Math.ceil(history.length / pageSize)
  const paginatedHistory = history.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const [requestCopyText, setRequestCopyText] = useState("复制")
  const [responseCopyText, setResponseCopyText] = useState("复制")

  const handleCopy = async (text: string, type: "request" | "response") => {
    const setText = type === "request" ? setRequestCopyText : setResponseCopyText

    try {
      // Try modern Clipboard API first
      await navigator.clipboard.writeText(text)
      setText("已复制!")
      setTimeout(() => setText("复制"), 2000)
    } catch (err) {
      // Fallback to traditional method
      const textArea = document.createElement("textarea")
      textArea.value = text
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      document.body.appendChild(textArea)
      textArea.select()

      try {
        document.execCommand("copy")
        setText("已复制!")
        setTimeout(() => setText("复制"), 2000)
      } catch (execErr) {
        toast({
          title: "复制失败",
          description: "无法访问剪贴板，请手动复制",
          variant: "destructive",
        })
      }

      document.body.removeChild(textArea)
    }
  }

  const parseMarkdown = (text: string): React.ReactNode => {
    const lines = text.split("\n")
    const elements: React.ReactNode[] = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]

      // Headers
      if (line.startsWith("# ")) {
        elements.push(
          <h1 key={i} className="text-xl font-bold mt-4 mb-2">
            {line.slice(2)}
          </h1>,
        )
        i++
        continue
      }
      if (line.startsWith("## ")) {
        elements.push(
          <h2 key={i} className="text-lg font-bold mt-3 mb-2">
            {line.slice(3)}
          </h2>,
        )
        i++
        continue
      }
      if (line.startsWith("### ")) {
        elements.push(
          <h3 key={i} className="text-base font-bold mt-2 mb-1">
            {line.slice(4)}
          </h3>,
        )
        i++
        continue
      }
      if (line.startsWith("#### ")) {
        elements.push(
          <h4 key={i} className="text-sm font-bold mt-2 mb-1">
            {line.slice(5)}
          </h4>,
        )
        i++
        continue
      }
      if (line.startsWith("##### ")) {
        elements.push(
          <h5 key={i} className="text-xs font-bold mt-1 mb-1">
            {line.slice(6)}
          </h5>,
        )
        i++
        continue
      }
      if (line.startsWith("###### ")) {
        elements.push(
          <h6 key={i} className="text-xs font-semibold mt-1 mb-1">
            {line.slice(7)}
          </h6>,
        )
        i++
        continue
      }

      // Markdown tables
      if (line.includes("|") && line.trim().startsWith("|") && line.trim().endsWith("|")) {
        const tableRows: React.ReactNode[] = []
        let headerCells: string[] = []

        // Parse header row
        if (i < lines.length) {
          const headerLine = lines[i].trim()
          headerCells = headerLine
            .split("|")
            .map((cell) => cell.trim())
            .filter((cell) => cell.length > 0)
          i++

          // Skip separator row (|---|---| or |:---:|)
          if (i < lines.length && lines[i].trim().match(/^\|[\s\-:]+\|/)) {
            i++
          }

          // Add header row
          if (headerCells.length > 0) {
            tableRows.push(
              <tr key="header">
                {headerCells.map((cell, idx) => (
                  <th key={idx} className="border border-border px-2 py-1 text-left font-semibold bg-muted">
                    {parseInlineMarkdown(cell)}
                  </th>
                ))}
              </tr>,
            )
          }
        }

        // Parse data rows
        while (i < lines.length) {
          const currentLine = lines[i].trim()
          // Check if it's still a table row (must start and end with |)
          if (currentLine.includes("|") && currentLine.startsWith("|") && currentLine.endsWith("|")) {
            // Skip if it's a separator row
            if (currentLine.match(/^\|[\s\-:]+\|$/)) {
              i++
              continue
            }

            const cells = currentLine
              .split("|")
              .map((cell) => cell.trim())
              .filter((cell) => cell.length > 0)

            // Ensure we have the same number of cells as header
            while (cells.length < headerCells.length) {
              cells.push("")
            }

            tableRows.push(
              <tr key={i}>
                {cells.slice(0, headerCells.length).map((cell, idx) => (
                  <td key={idx} className="border border-border px-2 py-1">
                    {parseInlineMarkdown(cell)}
                  </td>
                ))}
              </tr>,
            )
            i++
          } else {
            // Not a table row anymore, break
            break
          }
        }

        if (tableRows.length > 0) {
          elements.push(
            <div key={`table-${i}`} className="my-4 overflow-x-auto">
              <table className="border-collapse border border-border w-full text-sm">
                <thead>{tableRows[0]}</thead>
                <tbody>{tableRows.slice(1)}</tbody>
              </table>
            </div>,
          )
        }
        continue
      }

      // Unordered lists
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        const listItems: React.ReactNode[] = []
        while (i < lines.length && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))) {
          const itemText = lines[i].trim().slice(2)
          listItems.push(
            <li key={i} className="ml-4">
              {parseInlineMarkdown(itemText)}
            </li>,
          )
          i++
        }
        elements.push(
          <ul key={`ul-${i}`} className="list-disc my-2">
            {listItems}
          </ul>,
        )
        continue
      }

      // Ordered lists
      if (/^\d+\.\s/.test(line.trim())) {
        const listItems: React.ReactNode[] = []
        while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
          const itemText = lines[i].trim().replace(/^\d+\.\s/, "")
          listItems.push(
            <li key={i} className="ml-4">
              {parseInlineMarkdown(itemText)}
            </li>,
          )
          i++
        }
        elements.push(
          <ol key={`ol-${i}`} className="list-decimal my-2">
            {listItems}
          </ol>,
        )
        continue
      }

      // Blockquotes
      if (line.startsWith("> ")) {
        const quoteLines: string[] = []
        while (i < lines.length && lines[i].startsWith("> ")) {
          quoteLines.push(lines[i].slice(2))
          i++
        }
        elements.push(
          <blockquote key={`quote-${i}`} className="border-l-4 border-muted pl-4 my-2 italic text-muted-foreground">
            {quoteLines.join("\n")}
          </blockquote>,
        )
        continue
      }

      // Horizontal rule
      if (line.trim() === "---" || line.trim() === "***") {
        elements.push(<hr key={i} className="my-4 border-t border-border" />)
        i++
        continue
      }

      // Empty line
      if (line.trim() === "") {
        elements.push(<br key={i} />)
        i++
        continue
      }

      // Regular paragraph
      elements.push(
        <p key={i} className="my-1">
          {parseInlineMarkdown(line)}
        </p>,
      )
      i++
    }

    return <div>{elements}</div>
  }

  const parseInlineMarkdown = (text: string): React.ReactNode => {
    const parts: { key: string; element: React.ReactNode }[] = []
    let currentText = text
    let keyCounter = 0

    // Bold **text** - improved regex to handle edge cases like **关键位:**
    // Use [^*] to ensure we don't match nested ** inside
    currentText = currentText.replace(/\*\*([^*]+?)\*\*/g, (match, content) => {
      const key = `bold-${keyCounter++}`
      parts.push({ key, element: <strong key={key}>{content}</strong> })
      return `<<${key}>>`
    })

    // Italic *text* - only match single * that are not part of **
    // Match *text* but avoid matching **text** by checking it's not preceded or followed by *
    currentText = currentText.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, (match, content) => {
      const key = `italic-${keyCounter++}`
      parts.push({ key, element: <em key={key}>{content}</em> })
      return `<<${key}>>`
    })

    // Inline code `code`
    currentText = currentText.replace(/`([^`]+?)`/g, (match, content) => {
      const key = `code-${keyCounter++}`
      parts.push({
        key,
        element: (
          <code key={key} className="bg-muted px-1 py-0.5 rounded text-xs">
            {content}
          </code>
        ),
      })
      return `<<${key}>>`
    })

    // Links [text](url) - fix the regex from the original $$ pattern
    currentText = currentText.replace(/\[([^\]]+?)\]$$([^)]+?)$$/g, (match, linkText, url) => {
      const key = `link-${keyCounter++}`
      parts.push({
        key,
        element: (
          <a key={key} href={url} className="text-primary underline" target="_blank" rel="noopener noreferrer">
            {linkText}
          </a>
        ),
      })
      return `<<${key}>>`
    })

    // Split by placeholders and reconstruct
    const segments = currentText.split(/(<<[^>]+>>)/)
    const result: React.ReactNode[] = []

    segments.forEach((segment) => {
      if (segment.startsWith("<<") && segment.endsWith(">>")) {
        const key = segment.slice(2, -2)
        const part = parts.find((p) => p.key === key)
        if (part) {
          result.push(part.element)
        } else {
          result.push(segment)
        }
      } else if (segment) {
        result.push(segment)
      }
    })

    return result.length > 0 ? result : text
  }

  const renderContentWithCodeBlocks = (content: string, cellId: string, isExpanded: boolean, images?: string[]) => {
    let processedContent = content
    let isJson = false

    if (parseResponseMarkdown && !content.includes("```")) {
      return (
        <>
          {images && images.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {images.map((imgUrl, idx) => (
                <div key={idx} className="relative group rounded border overflow-hidden bg-muted">
                  <img
                    src={imgUrl || "/placeholder.svg"}
                    alt={`Generated image ${idx + 1}`}
                    className="size-20 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() =>
                      setZoomedImage({
                        id: `response-${cellId}-${idx}`,
                        type: "url",
                        base64: imgUrl,
                      })
                    }
                    title="点击查看大图"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setZoomedImage({
                          id: `response-${cellId}-${idx}`,
                          type: "url",
                          base64: imgUrl,
                        })
                      }
                      title="放大查看"
                    >
                      <ZoomIn className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {parseMarkdown(content)}
        </>
      )
    }

    try {
      // Check if content looks like JSON (starts with { or [)
      const trimmed = content.trim()
      if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        // Try to verify it's valid JSON
        JSON.parse(trimmed)
        // If successfully parsed, wrap original content in json code block without formatting
        processedContent = "```json\n" + trimmed + "\n```"
        isJson = true
      }
    } catch (e) {
      // Not valid JSON, use original content
    }

    const parts = processedContent.split(/(```[\s\S]*?```)/g)

    return (
      <>
        {images && images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {images.map((imgUrl, idx) => (
              <div key={idx} className="relative group rounded border overflow-hidden bg-muted">
                <img
                  src={imgUrl || "/placeholder.svg"}
                  alt={`Generated image ${idx + 1}`}
                  className="size-20 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() =>
                    setZoomedImage({
                      id: `response-${cellId}-${idx}`,
                      type: "url",
                      base64: imgUrl,
                    })
                  }
                  title="点击查看大图"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setZoomedImage({
                        id: `response-${cellId}-${idx}`,
                        type: "url",
                        base64: imgUrl,
                      })
                    }
                    title="放大查看"
                  >
                    <ZoomIn className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {parts.map((part, index) => {
          if (part.startsWith("```") && part.endsWith("```")) {
            const lines = part.split("\n")
            const language = lines[0].replace("```", "").trim()
            const codeLines = lines.slice(1, -1)
            const code = codeLines.join("\n")
            const lineCount = codeLines.length

            return (
              <div key={index} className="my-2 rounded-md bg-muted overflow-hidden border relative">
                {language && (
                  <div className="px-3 py-1 text-xs text-muted-foreground bg-muted/50 border-b">{language}</div>
                )}
                <pre
                  className={`p-3 overflow-x-auto text-xs ${
                    !isExpanded && lineCount > 3 ? "max-h-24 overflow-y-hidden" : ""
                  }`}
                >
                  <code className="block">{code}</code>
                </pre>
                {!isExpanded && lineCount > 3 && (
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-muted to-transparent pointer-events-none" />
                )}
              </div>
            )
          }
          return (
            <span key={index} className={`${!isExpanded && part.trim().length > 100 ? "line-clamp-2" : ""}`}>
              {part}
            </span>
          )
        })}
      </>
    )
  }

  const expandAllHistory = false // Placeholder to resolve lint error, can be replaced with actual state if needed.

  const applyHistoryItem = (item: ModelHistoryItem) => {
    setProvider(item.provider)
    setModel(item.model)
    setApiKey(item.apiKey)
    setBaseURL(item.baseURL)
    setApiPath(item.apiPath)

    // Re-evaluate local file states based on loaded values
    // This is a simplified approach; a more robust solution might involve checking if apiKey/baseURL/apiPath match known file paths.
    // For now, we assume if provider is custom and baseURL/apiPath are set, they might be from a file.
    // However, directly inferring from file path after loading from history is complex.
    // We'll reset them to false and rely on the user to re-select if needed.
    setIsPromptFromLocalFile(false)
    promptFileHandleRef.current = null
    setIsSystemPromptFromLocalFile(false)
    systemPromptFileHandleRef.current = null

    toast({
      title: "配置已应用",
      description: `已应用 ${item.provider} - ${item.model} 的配置`,
      className: "bg-blue-50 border-blue-200",
      duration: 2000,
    })
  }

  // 自动保存 modelHistory 到 localStorage
  useEffect(() => {
    if (modelHistory.length > 0) {
      try {
        localStorage.setItem("modelHistory", JSON.stringify(modelHistory))
      } catch (error) {
        console.error("[v0] Failed to save model history to localStorage:", error)
      }
    }
  }, [modelHistory])

  const clearModelHistory = () => {
    setModelHistory([])
    setModelHistoryPage(1)
    // 清空 localStorage
    try {
      localStorage.removeItem("modelHistory")
    } catch (error) {
      console.error("[v0] Failed to clear model history from localStorage:", error)
    }
    toast({
      title: "历史记录已清空",
      duration: 2000,
    })
  }

  const exportModelHistoryToCSV = () => {
    if (modelHistory.length === 0) {
      toast({
        variant: "destructive",
        title: "无数据导出",
        description: "历史记录为空",
        duration: 2000,
      })
      return
    }

    const headers = ["时间", "提供商", "模型名", "API Key", "状态", "响应延迟(ms)"]
    const rows = modelHistory.map((item) => [
      new Date(item.timestamp).toLocaleString("zh-CN"),
      item.provider,
      item.model,
      item.apiKey.substring(0, 10) + "...",
      item.status === "success" ? "成功" : item.status === "error" ? "失败" : "未测试",
      item.duration ? item.duration.toString() : "N/A",
    ])

    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n")

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `model-history-${Date.now()}.csv`
    link.click()

    toast({
      title: "导出成功",
      description: `已导出 ${modelHistory.length} 条记录`,
      className: "bg-green-50 border-green-200",
      duration: 2000,
    })
  }

  const modelHistoryTotalPages = Math.ceil(modelHistory.length / modelHistoryPageSize)
  const paginatedModelHistory = modelHistory.slice(
    (modelHistoryPage - 1) * modelHistoryPageSize,
    modelHistoryPage * modelHistoryPageSize,
  )

  const filteredOpenRouterModels = useMemo(() => {
    let filtered = openrouterModels

    // Filter by search query - 从 model id 和 name 匹配
    if (modelSearchQuery.trim()) {
      const query = modelSearchQuery.toLowerCase()
      filtered = filtered.filter((model) => {
        const idMatch = model.id.toLowerCase().includes(query)
        const nameMatch = model.name?.toLowerCase().includes(query) || false
        return idMatch || nameMatch
      })
    }

    return filtered
  }, [openrouterModels, modelSearchQuery])

  const filteredCerebrasModels = useMemo(() => {
    let filtered = cerebrasModels

    // Filter by search query - 从 model id 和 name 匹配
    if (modelSearchQuery.trim()) {
      const query = modelSearchQuery.toLowerCase()
      filtered = filtered.filter((model) => {
        const idMatch = model.id.toLowerCase().includes(query)
        const nameMatch = model.name?.toLowerCase().includes(query) || false
        return idMatch || nameMatch
      })
    }

    return filtered
  }, [cerebrasModels, modelSearchQuery])

  const filteredModelScopeModels = useMemo(() => {
    let filtered = modelscopeModels

    // Filter by search query - 从 model id 和 name 匹配
    if (modelSearchQuery.trim()) {
      const query = modelSearchQuery.toLowerCase()
      filtered = filtered.filter((model) => {
        const idMatch = model.id.toLowerCase().includes(query)
        const nameMatch = model.name?.toLowerCase().includes(query) || false
        return idMatch || nameMatch
      })
    }

    return filtered
  }, [modelscopeModels, modelSearchQuery])

  // 获取当前选中模型的显示名称（用于下拉框按钮显示）
  const selectedModelDisplayName = useMemo(() => {
    if (provider === "openrouter" && model && selectedModelInfoForPath) {
      return selectedModelInfoForPath.name || selectedModelInfoForPath.id
    }
    if (provider === "cerebras" && model && selectedModelInfoForPath) {
      return selectedModelInfoForPath.name || selectedModelInfoForPath.id
    }
    if (provider === "modelscope" && model && selectedModelInfoForPath) {
      return selectedModelInfoForPath.name || selectedModelInfoForPath.id
    }
    return model || ""
  }, [provider, model, selectedModelInfoForPath])

  // 备用翻译 API 1: LibreTranslate (免费开源翻译服务)
  const translateWithLibreTranslate = async (text: string): Promise<string | null> => {
    try {
      // 使用公共 LibreTranslate 实例
      const response = await fetch("https://libretranslate.de/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: text,
          source: "en",
          target: "zh",
          format: "text",
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.translatedText) {
          console.log("[v0] LibreTranslate 翻译成功")
          return data.translatedText
        }
      }
    } catch (error) {
      console.warn("[v0] LibreTranslate 翻译失败:", error)
    }
    return null
  }

  // 备用翻译 API 2: Google Translate 免费接口（通过代理）
  const translateWithGoogleTranslate = async (text: string): Promise<string | null> => {
    try {
      // 使用 Google Translate 的免费接口（通过第三方代理）
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`,
      )

      if (response.ok) {
        const data = await response.json()
        if (data && data[0] && Array.isArray(data[0])) {
          const translated = data[0].map((item: any[]) => item[0]).join("")
          if (translated) {
            console.log("[v0] Google Translate 翻译成功")
            return translated
          }
        }
      }
    } catch (error) {
      console.warn("[v0] Google Translate 翻译失败:", error)
    }
    return null
  }

  // 主翻译 API: MyMemory Translation API
  const translateWithMyMemory = async (text: string): Promise<string | null> => {
    try {
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`,
      )

      if (response.ok) {
        const data = await response.json()
        console.log("[v0] MyMemory API 响应:", data)

        // 检查是否是配额用尽的警告
        if (
          data.responseStatus === 429 ||
          (data.responseData?.translatedText && data.responseData.translatedText.includes("MYMEMORY WARNING"))
        ) {
          console.warn("[v0] MyMemory API 配额已用尽")
          return null // 返回 null 触发备用机制
        }

        if (data.responseData && data.responseData.translatedText) {
          console.log("[v0] MyMemory 翻译成功")
          return data.responseData.translatedText
        }
      } else if (response.status === 429) {
        console.warn("[v0] MyMemory API 配额已用尽 (HTTP 429)")
        return null
      }
    } catch (error) {
      console.warn("[v0] MyMemory API 翻译失败:", error)
    }
    return null
  }

  // 翻译 description 为中文（带备用机制）
  const translateDescription = useCallback(async (text: string) => {
    if (!text) {
      console.log("[v0] translateDescription: 文本为空，跳过翻译")
      return
    }

    console.log("[v0] translateDescription: 开始翻译，文本长度:", text.length)
    setIsTranslating(true)
    setTranslatedDescription("") // 清空之前的翻译结果
    setTranslationError("") // 清空之前的错误信息
    try {
      // MyMemory Translation API 有 500 字符限制，需要分段翻译长文本
      const MAX_LENGTH = 500

      if (text.length <= MAX_LENGTH) {
        // 文本长度在限制内，直接翻译
        // 按优先级尝试多个翻译 API
        let translated: string | null = null

        // 1. 尝试 MyMemory API
        translated = await translateWithMyMemory(text)

        // 2. 如果 MyMemory 失败，尝试 LibreTranslate
        if (!translated) {
          console.log("[v0] 切换到备用翻译 API: LibreTranslate")
          translated = await translateWithLibreTranslate(text)
        }

        // 3. 如果 LibreTranslate 也失败，尝试 Google Translate
        if (!translated) {
          console.log("[v0] 切换到备用翻译 API: Google Translate")
          translated = await translateWithGoogleTranslate(text)
        }

        if (translated) {
          console.log("[v0] 翻译成功:", translated.substring(0, 100))
          setTranslatedDescription(translated)
        } else {
          console.warn("[v0] 所有翻译 API 都失败了")
          setTranslatedDescription("")
          setTranslationError("翻译失败：所有翻译服务暂时不可用，请稍后重试")
        }
      } else {
        // 文本超过限制，分段翻译
        const segments: string[] = []
        for (let i = 0; i < text.length; i += MAX_LENGTH) {
          const segment = text.substring(i, i + MAX_LENGTH)
          segments.push(segment)
        }

        // 长文本分段翻译，使用备用机制
        const translatedSegments: string[] = []
        let hasTranslationError = false
        let currentApi = "mymemory" // 当前使用的 API

        for (const segment of segments) {
          let translated: string | null = null

          // 按优先级尝试翻译 API
          if (currentApi === "mymemory") {
            translated = await translateWithMyMemory(segment)
            if (!translated) {
              console.log("[v0] MyMemory 失败，切换到 LibreTranslate")
              currentApi = "libretranslate"
            }
          }

          if (!translated && currentApi === "libretranslate") {
            translated = await translateWithLibreTranslate(segment)
            if (!translated) {
              console.log("[v0] LibreTranslate 失败，切换到 Google Translate")
              currentApi = "google"
            }
          }

          if (!translated && currentApi === "google") {
            translated = await translateWithGoogleTranslate(segment)
          }

          if (translated) {
            translatedSegments.push(translated)
          } else {
            translatedSegments.push(segment) // 翻译失败，使用原文
            hasTranslationError = true
          }

          // 添加小延迟避免请求过快
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        if (hasTranslationError) {
          setTranslationError("翻译失败：部分内容无法翻译")
        }
        setTranslatedDescription(translatedSegments.join(""))
      }
    } catch (error) {
      console.error("[v0] Error translating description:", error)
      setTranslatedDescription("")
      setTranslationError(`翻译失败：${error instanceof Error ? error.message : "网络请求失败"}`)
    } finally {
      setIsTranslating(false)
    }
  }, [])

  // 当 selectedModelInfo 的 description 变化时，自动翻译
  useEffect(() => {
    console.log("[v0] Translation useEffect 触发:", {
      provider,
      hasDescription: !!selectedModelInfoForPath?.description,
      descriptionLength: selectedModelInfoForPath?.description?.length,
      modelId: selectedModelInfoForPath?.id,
    })

    // 清空之前的翻译结果和错误信息
    setTranslatedDescription("")
    setIsTranslating(false)
    setTranslationError("")

    if (provider === "openrouter" && selectedModelInfoForPath?.description) {
      const description = selectedModelInfoForPath.description.trim()
      if (!description) {
        console.log("[v0] Translation: description 为空，跳过翻译")
        return
      }

      // 检查是否已经是中文（简单判断：如果包含中文字符，可能已经是中文）
      const hasChinese = /[\u4e00-\u9fa5]/.test(description)
      console.log("[v0] Translation: 检查中文", { hasChinese, descriptionPreview: description.substring(0, 50) })

      if (!hasChinese) {
        // 延迟一点执行，确保状态已重置
        console.log("[v0] Translation: 准备翻译，延迟 100ms")
        const timer = setTimeout(() => {
          console.log("[v0] Translation: 开始调用 translateDescription")
          translateDescription(description)
        }, 100)
        return () => {
          console.log("[v0] Translation: 清理定时器")
          clearTimeout(timer)
        }
      } else {
        console.log("[v0] Translation: 文本已包含中文，跳过翻译")
      }
    } else {
      console.log("[v0] Translation: 条件不满足", { provider, hasDescription: !!selectedModelInfoForPath?.description })
    }
  }, [provider, selectedModelInfoForPath?.description, selectedModelInfoForPath?.id, translateDescription])

  const handleAddImageUrl = async () => {
    if (!imageUrl.trim()) {
      toast({
        variant: "destructive",
        title: "错误",
        description: "请输入图片链接",
      })
      return
    }

    setIsAddingImageUrl(true)

    try {
      const urlWithCacheBust = imageUrl.trim().includes("?")
        ? `${imageUrl.trim()}&_t=${Date.now()}`
        : `${imageUrl.trim()}?_t=${Date.now()}`

      const response = await fetch(urlWithCacheBust, {
        cache: "no-store", // Force no caching
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()

      if (!blob.type.startsWith("image/")) {
        toast({
          variant: "destructive",
          title: "错误",
          description: "URL 不是有效的图片",
        })
        setIsAddingImageUrl(false)
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const base64String = event.target?.result as string

        const newImage: MessageImage = {
          id: Date.now().toString(),
          type: "url",
          url: imageUrl.trim(), // Store original URL (without cache-bust parameter)
          base64: base64String,
          mimeType: blob.type,
        }

        setMessageImages((prev) => [...prev, newImage])
        setImageUrl("")
        setShowImageUrlInput(false)
        setIsAddingImageUrl(false)
        toast({
          title: "成功",
          description: "图片已加载并添加",
        })
      }

      reader.onerror = () => {
        toast({
          variant: "destructive",
          title: "错误",
          description: "转换图片失败",
        })
        setIsAddingImageUrl(false)
      }

      reader.readAsDataURL(blob)
    } catch (error) {
      console.error("[v0] Error loading image from URL:", error) // Changed from "[v0] Error loading image from URL:"
      setIsAddingImageUrl(false)
      toast({
        variant: "destructive",
        title: "加载失败",
        description: error instanceof Error ? error.message : "无法加载图片",
      })
    }
  }

  const handleImageFileUpload = async () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      if (!file.type.startsWith("image/")) {
        toast({
          variant: "destructive",
          title: "错误",
          description: "请选择图片文件",
        })
        return
      }

      try {
        const reader = new FileReader()
        reader.onload = (event) => {
          const base64String = event.target?.result as string

          const newImage: MessageImage = {
            id: Date.now().toString(),
            type: "file",
            base64: base64String,
            mimeType: file.type,
            name: file.name,
          }

          setMessageImages((prev) => [...prev, newImage])
          toast({
            title: "成功",
            description: `图片 ${file.name} 已添加`,
          })

          // Trigger auto-reload if enabled
          if (autoReloadImages) {
            console.log("[v0] Auto-reloading images after upload...")
            handleTest() // Re-run the test
          }
        }

        reader.onerror = () => {
          toast({
            variant: "destructive",
            title: "错误",
            description: "读取图片文件失败",
          })
        }

        reader.readAsDataURL(file)
      } catch (error) {
        console.error("[v0] Error reading image file:", error)
        toast({
          variant: "destructive",
          title: "错误",
          description: "读取图片文件失败",
        })
      }
    }

    input.click()
  }

  const handleRemoveImage = (imageId: string) => {
    setMessageImages((prev) => prev.filter((img) => img.id !== imageId))
  }

  useEffect(() => {
    if (autoReloadImages && messageImages.some((img) => img.type === "url")) {
      console.log("[v0] Auto-reload images is enabled, images will be reloaded before next test")
    }
  }, [autoReloadImages, messageImages])

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center gap-4 px-4 md:px-8">
          {/* CHANGE: Removed "LLM API 测试工具" text, keeping only the icon */}
          <div className="flex items-center gap-2">
            <Zap className="size-6 text-primary" />
            {probeStatus !== "idle" && (
              <div className="ml-2 flex items-center gap-1.5">
                <div
                  className={`size-2 rounded-full ${probeStatus === "success" ? "bg-green-500" : "bg-red-500"}`}
                  title={probeStatus === "success" ? "API 配置正常" : "API 配置异常"}
                />
                {probeStatus === "success" && probeDuration && (
                  <span className="text-xs text-muted-foreground">{probeDuration}ms</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={runProbeTest}
                  disabled={isProbeTesting || !apiKey || !model || !fullApiPath}
                  className="h-6 px-2"
                  title="重新测试"
                >
                  {isProbeTesting ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                </Button>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="提供商">{API_PROVIDERS.find((p) => p.id === provider)?.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {API_PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{p.name}</span>
                      {p.endpoint && <span className="text-xs text-muted-foreground">{p.endpoint}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {provider === "openrouter" || provider === "cerebras" || provider === "modelscope" ? (
              <div className="flex items-center gap-2">
                {!isCustomModel ? (
                  <>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          disabled={isLoadingModels}
                          className="w-[280px] justify-between bg-transparent"
                        >
                          <span className="truncate">
                            {selectedModelDisplayName || (isLoadingModels ? "加载中..." : "选择模型")}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="搜索模型..."
                            value={modelSearchQuery}
                            onValueChange={setModelSearchQuery}
                          />
                          <CommandList>
                            <CommandEmpty>未找到模型</CommandEmpty>
                            <CommandGroup>
                              {provider === "openrouter"
                                ? filteredOpenRouterModels.map((m) => {
                                    // 检查是否是免费模型（name 中包含 "(free)"）
                                    const isFreeModel = m.name?.includes("(free)") || false
                                    // 如果是免费模型，id 需要添加 :free 后缀
                                    const modelIdToUse = isFreeModel ? `${m.id}:free` : m.id
                                    // CommandItem 的 value 包含 id 和 name，以便 Command 组件也能搜索 name
                                    const searchableValue = [m.id, m.name].filter(Boolean).join(" ")

                                    return (
                                      <CommandItem
                                        key={m.id}
                                        value={searchableValue}
                                        onSelect={() => {
                                          setModel(modelIdToUse)
                                          // 不清空搜索词，保持搜索状态
                                        }}
                                      >
                                        <div className="flex flex-col gap-0.5">
                                          <span className="font-medium">{m.name || m.id}</span>
                                          {m.context_length && (
                                            <span className="text-xs text-muted-foreground">
                                              {m.context_length} tokens
                                            </span>
                                          )}
                                        </div>
                                      </CommandItem>
                                    )
                                  })
                                : provider === "cerebras"
                                  ? filteredCerebrasModels.map((m) => {
                                      // CommandItem 的 value 包含 id 和 name，以便 Command 组件也能搜索 name
                                      const searchableValue = [m.id, m.name].filter(Boolean).join(" ")

                                      return (
                                        <CommandItem
                                          key={m.id}
                                          value={searchableValue}
                                          onSelect={() => {
                                            setModel(m.id)
                                            // 不清空搜索词，保持搜索状态
                                          }}
                                        >
                                          <div className="flex flex-col gap-0.5">
                                            <span className="font-medium">{m.name || m.id}</span>
                                            {m.context_length && (
                                              <span className="text-xs text-muted-foreground">
                                                {m.context_length} tokens
                                              </span>
                                            )}
                                          </div>
                                        </CommandItem>
                                      )
                                    })
                                  : filteredModelScopeModels.map((m) => {
                                      // CommandItem 的 value 包含 id 和 name，以便 Command 组件也能搜索 name
                                      const searchableValue = [m.id, m.name].filter(Boolean).join(" ")

                                      return (
                                        <CommandItem
                                          key={m.id}
                                          value={searchableValue}
                                          onSelect={() => {
                                            setModel(m.id)
                                            // 不清空搜索词，保持搜索状态
                                          }}
                                        >
                                          <div className="flex flex-col gap-0.5">
                                            <span className="font-medium">{m.name || m.id}</span>
                                            {m.context_length && (
                                              <span className="text-xs text-muted-foreground">
                                                {m.context_length} tokens
                                              </span>
                                            )}
                                            {m.task_types && (
                                              <span className="text-xs text-muted-foreground">
                                                {Array.isArray(m.task_types) ? m.task_types.join(", ") : m.task_types}
                                              </span>
                                            )}
                                          </div>
                                        </CommandItem>
                                      )
                                    })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button variant="ghost" size="sm" onClick={() => setIsCustomModel(true)} title="自定义模型">
                      <Pencil className="size-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Input
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="输入自定义模型 ID"
                      className="w-[280px]"
                    />
                    <Button variant="ghost" size="sm" onClick={() => setIsCustomModel(false)} title="返回下拉选择">
                      <List className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="eg: gpt-3.5-turbo"
                className="w-[200px]"
              />
            )}

            <div className="relative flex items-center">
              <Input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="API Key"
                className="w-[200px] pr-10"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-0 h-full px-3 hover:bg-transparent"
                title={showApiKey ? "隐藏 API Key" : "显示 API Key"}
              >
                {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="mr-2 size-4" />
              重置
            </Button>
          </div>
        </div>

        {(provider === "custom" || !API_PROVIDERS.find((p) => p.id === provider)?.endpoint) && (
          <div className="border-t px-4 py-3 md:px-8">
            <div className="flex items-center gap-2">
              <Label htmlFor="baseURL" className="text-sm font-medium whitespace-nowrap">
                Base URL
              </Label>
              <Input
                id="baseURL"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                placeholder="https://api.example.com"
                className="max-w-2xl"
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Label htmlFor="apiPath" className="text-sm font-medium whitespace-nowrap">
                API Path
              </Label>
              <Input
                id="apiPath"
                value={apiPath}
                onChange={(e) => setApiPath(e.target.value)}
                placeholder="/v1/chat/completions"
                className="max-w-2xl"
              />
            </div>
          </div>
        )}
      </nav>

      {/* OpenRouter 和 Cerebras 模型信息显示 */}
      {(provider === "openrouter" || provider === "cerebras" || provider === "modelscope") &&
        selectedModelInfoForPath && (
          <div className="border-b bg-muted/30 px-4 py-3 md:px-8">
            <div className="max-w-7xl mx-auto space-y-2">
              {selectedModelInfoForPath.description && (
                <div className="space-y-2">
                  {isTranslating ? (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedModelInfoForPath.description}
                      <span className="ml-2 text-xs opacity-60">翻译中...</span>
                    </p>
                  ) : translatedDescription ? (
                    <>
                      <p className="text-sm text-muted-foreground leading-relaxed">{translatedDescription}</p>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          查看原文
                        </summary>
                        <p className="mt-2 text-muted-foreground leading-relaxed">
                          {selectedModelInfoForPath.description}
                        </p>
                      </details>
                    </>
                  ) : translationError ? (
                    <div className="space-y-1">
                      <p className="text-sm text-destructive leading-relaxed">{translationError}</p>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          查看原文
                        </summary>
                        <p className="mt-2 text-muted-foreground leading-relaxed">
                          {selectedModelInfoForPath.description}
                        </p>
                      </details>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedModelInfoForPath.description}
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {selectedModelInfoForPath.link &&
                  (() => {
                    // 如果 name 包含 "(free)"，link 也增加 :free
                    const isFreeModel = selectedModelInfoForPath.name?.includes("(free)") || false
                    const linkToUse = isFreeModel
                      ? `${selectedModelInfoForPath.link}:free`
                      : selectedModelInfoForPath.link
                    return (
                      <a
                        href={linkToUse}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        <Link className="size-3" />
                        查看模型详情
                      </a>
                    )
                  })()}
                {selectedModelInfoForPath.pub_date && (
                  <span className="flex items-center gap-1">
                    <span>发布日期: {selectedModelInfoForPath.pub_date}</span>
                  </span>
                )}
                {provider === "modelscope" &&
                  (() => {
                    const modelScopeInfo = selectedModelInfoForPath as ModelScopeModel
                    return (
                      <>
                        {modelScopeInfo.time && (
                          <span className="flex items-center gap-1">
                            <span>{modelScopeInfo.time}</span>
                          </span>
                        )}
                        {modelScopeInfo.task_types && (
                          <span className="flex items-center gap-1">
                            <span>
                              {Array.isArray(modelScopeInfo.task_types)
                                ? modelScopeInfo.task_types.join(", ")
                                : modelScopeInfo.task_types}
                            </span>
                          </span>
                        )}
                        {modelScopeInfo.downloads !== undefined && (
                          <span className="flex items-center gap-1">
                            <Download className="size-3" />
                            <span>{modelScopeInfo.downloads.toLocaleString()}</span>
                          </span>
                        )}
                        {modelScopeInfo.stars !== undefined && (
                          <span className="flex items-center gap-1">
                            <Heart className="size-3 fill-current" />
                            <span>{modelScopeInfo.stars.toLocaleString()}</span>
                          </span>
                        )}
                      </>
                    )
                  })()}
              </div>
            </div>
          </div>
        )}

      <main className="container mx-auto p-4 md:p-8 space-y-6">
        {/* Add crypto trading states */}
        {/* The states are already declared at the top */}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>历史模型</CardTitle>
                <CardDescription>已测试的模型配置历史 (共 {modelHistory.length} 条)</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={clearModelHistory} disabled={modelHistory.length === 0}>
                  <RotateCcw className="mr-2 size-4" />
                  清空
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportModelHistoryToCSV}
                  disabled={modelHistory.length === 0}
                >
                  <Download className="mr-2 size-4" />
                  导出
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {modelHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">暂无历史记录</div>
            ) : (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">时间</TableHead>
                          <TableHead className="w-[120px]">提供商</TableHead>
                          <TableHead>模型</TableHead>
                          <TableHead className="w-[150px]">API Key</TableHead>
                          <TableHead className="w-[100px]">状态</TableHead>
                          <TableHead className="w-[100px]">延迟</TableHead>
                          <TableHead className="w-[160px] text-center">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedModelHistory.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs">
                              {new Date(item.timestamp).toLocaleString("zh-CN", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </TableCell>
                            <TableCell className="text-xs">{item.provider}</TableCell>
                            <TableCell className="text-xs font-mono">{item.model}</TableCell>
                            <TableCell className="text-xs">
                              <div className="flex items-center gap-1">
                                <span className="font-mono">
                                  {visibleApiKeys.has(item.id) ? item.apiKey : `${item.apiKey.substring(0, 10)}...`}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleApiKeyVisibility(item.id)}
                                  className="h-6 w-6 p-0"
                                >
                                  {visibleApiKeys.has(item.id) ? (
                                    <EyeOff className="size-3" />
                                  ) : (
                                    <Eye className="size-3" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-xs px-2 py-1 rounded ${
                                  item.status === "success"
                                    ? "bg-green-100 text-green-700"
                                    : item.status === "error"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {item.status === "success" ? "成功" : item.status === "error" ? "失败" : "未测试"}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs">
                              {item.duration !== null ? `${item.duration}ms` : "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => applyHistoryItem(item)}
                                  className="h-7 text-xs"
                                >
                                  应用
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => runHistoryProbeTest(item)}
                                  className="h-7 text-xs"
                                >
                                  测试
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteModelHistoryItem(item.id)}
                                  className="h-7 w-7 p-0"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {modelHistoryTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      第 {modelHistoryPage} / {modelHistoryTotalPages} 页
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setModelHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={modelHistoryPage === 1}
                      >
                        <ChevronLeft className="size-4" />
                        上一页
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setModelHistoryPage((p) => Math.min(modelHistoryTotalPages, p + 1))}
                        disabled={modelHistoryPage === modelHistoryTotalPages}
                      >
                        下一页
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>K线图</CardTitle>
                <CardDescription>点击K线时间点将数据填入上下文，或选择时间点加载历史数据</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <CandlestickChart
              data={klineData}
              onCandleClick={handleCandleClick}
              isLoading={isLoadingKline}
              tradingPair={tradingPair}
              onTradingPairChange={setTradingPair}
              klineInterval={klineInterval}
              onIntervalChange={setKlineInterval}
              popularPairs={popularPairs}
              intervals={intervals}
              onTimePointChange={setKlineEndTime}
              endTime={klineEndTime}
              limit={klineLimit}
              onLimitChange={setKlineLimit}
              onForceReload={forceReloadKlineData}
              markedCandleTime={markedCandleTime}
              onMarkedCandleTimeChange={setMarkedCandleTime}
              onIndicatorsChange={setContextIndicators}
            />
          </CardContent>
        </Card>

        {/* Parameters Configuration - Full width */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsParametersExpanded(!isParametersExpanded)}>
                  {isParametersExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </Button>
                <div>
                  <CardTitle>参数配置</CardTitle>
                  <CardDescription>调整 Chat Completion 参数</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleResetParameters}>
                  <RotateCcw className="mr-2 size-4" />
                  重置参数
                </Button>
                {isTimerRunning ? (
                  <Button onClick={stopTimer} variant="destructive" size="sm">
                    <StopCircle className="mr-2 size-4" />
                    停止定时
                  </Button>
                ) : loading ? (
                  <Button onClick={handleInterruptTest} variant="destructive" size="sm">
                    <X className="mr-2 size-4" />
                    中断
                  </Button>
                ) : (
                  <Button onClick={handleStartTest} disabled={loading} size="sm">
                    <Play className="mr-2 size-4" />
                    开始测试
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          {isParametersExpanded && (
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {/* Context input - readonly, for K-line data */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <Label htmlFor="context">上下文</Label>
                      <p className="text-xs text-muted-foreground">K线数据等上下文信息（只读）</p>
                      {context && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {[...baseContextFilterOptions, ...indicatorFilterOptions].map((option) => (
                            <Button
                              key={option.key}
                              type="button"
                              variant={contextFilter === option.key ? "default" : "outline"}
                              size="sm"
                              disabled={option.disabled}
                              onClick={() => setContextFilter(option.key)}
                              className="h-7 px-2 text-xs"
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {context && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsContextExpanded(!isContextExpanded)}
                          className="h-7 px-2 text-xs"
                        >
                          {isContextExpanded ? (
                            <>
                              <ChevronUp className="mr-1 h-3.5 w-3.5" />
                              收起
                            </>
                          ) : (
                            <>
                              <ChevronDown className="mr-1 h-3.5 w-3.5" />
                              展开
                            </>
                          )}
                        </Button>
                      )}
                      {context && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setContext("")}
                          className="h-7 px-2 text-xs"
                        >
                          清除
                        </Button>
                      )}
                    </div>
                  </div>
                  <Textarea
                    id="context"
                    value={filteredContext}
                    readOnly
                    placeholder="点击K线时间点将数据填入此处..."
                    rows={4}
                    className={`bg-muted/50 cursor-not-allowed resize-none ${isContextExpanded ? "" : "max-h-32 overflow-y-auto"}`}
                  />
                </div>

                {!enablePromptFile && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="userMessage">用户消息</Label>
                        <p className="text-xs text-muted-foreground">输入测试用的消息内容</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                      >
                        {isPromptExpanded ? (
                          <>
                            <ChevronUp className="mr-1 h-4 w-4" />
                            收起
                          </>
                        ) : (
                          <>
                            <ChevronDown className="mr-1 h-4 w-4" />
                            展开
                          </>
                        )}
                      </Button>
                    </div>
                    <Textarea
                      id="userMessage"
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      placeholder="输入你的提示词..."
                      rows={3}
                      className={isPromptExpanded ? "" : "max-h-32 overflow-y-auto"}
                    />
                  </>
                )}

                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5" />
                      图片附件
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowImageUrlInput(!showImageUrlInput)}
                      >
                        <Link className="mr-1 h-3.5 w-3.5" />
                        添加链接
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={handleImageFileUpload}>
                        <Upload className="h-4 w-4 mr-1" />
                        上传文件
                      </Button>
                      <div className="flex items-center gap-2 ml-auto">
                        <input
                          type="checkbox"
                          id="autoReloadImages"
                          checked={autoReloadImages}
                          onChange={(e) => setAutoReloadImages(e.target.checked)}
                          className="h-4 w-4 rounded border-input bg-background accent-primary cursor-pointer"
                        />
                        <Label htmlFor="autoReloadImages" className="cursor-pointer font-normal text-sm">
                          自动重载
                        </Label>
                      </div>
                    </div>
                  </div>

                  {showImageUrlInput && (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="输入图片链接 (https://...)"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleAddImageUrl()
                            }
                          }}
                          disabled={isAddingImageUrl}
                        />
                        <Button onClick={handleAddImageUrl} size="sm" disabled={isAddingImageUrl}>
                          {isAddingImageUrl ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </>
                          ) : (
                            "添加"
                          )}
                        </Button>
                        <Button
                          onClick={() => {
                            setShowImageUrlInput(false)
                            setImageUrl("")
                          }}
                          variant="ghost"
                          size="sm"
                          disabled={isAddingImageUrl}
                        >
                          取消
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        示例: https://api.btstu.cn/sjbz/api.php?lx=dongman&format=images
                      </p>
                    </div>
                  )}

                  {/* Image previews grid */}
                  {messageImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {messageImages.map((img) => (
                        <div key={img.id} className="relative group rounded-md border overflow-hidden">
                          <img
                            src={img.base64 || img.url}
                            alt={img.name || "Image"}
                            className="w-full h-24 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setZoomedImage(img)}
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setZoomedImage(img)}
                              title="放大查看"
                            >
                              <ZoomIn className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveImage(img.id)}
                              title="删除图片"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      从外部加载用户消息
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="enablePromptFile"
                        checked={enablePromptFile}
                        onChange={(e) => setEnablePromptFile(e.target.checked)}
                        className="h-4 w-4 rounded border-input bg-background accent-primary cursor-pointer"
                      />
                      <Label htmlFor="enablePromptFile" className="cursor-pointer font-normal text-sm">
                        启用
                      </Label>
                      <input
                        type="checkbox"
                        id="autoReloadPrompt"
                        checked={autoReloadPrompt}
                        onChange={(e) => setAutoReloadPrompt(e.target.checked)}
                        disabled={!enablePromptFile}
                        className="h-4 w-4 rounded border-input bg-background accent-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <Label htmlFor="autoReloadPrompt" className="cursor-pointer font-normal text-sm">
                        自动重载
                      </Label>
                    </div>
                  </div>
                  {enablePromptFile && (
                    <>
                      <div className="flex gap-2">
                        <Input
                          id="promptFilePath"
                          value={promptFilePath}
                          onChange={(e) => {
                            setPromptFilePath(e.target.value)
                            setIsPromptFromLocalFile(false)
                            promptFileHandleRef.current = null
                            setLoadedPromptContent("")
                          }}
                          placeholder="https://example.com/prompt.txt 或点击选择本地文件"
                          className="text-sm flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleLocalFileSelect("prompt")}
                          className="shrink-0"
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          选择文件
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        支持 HTTP/HTTPS 链接或本地文件。点击"选择文件"按钮可直接选择本地 .txt 或 .md 文件。
                      </p>
                    </>
                  )}

                  {enablePromptFile && loadedPromptContent && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          外部加载的消息预览
                          {isPromptFromLocalFile && (
                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">
                              本地文件
                            </span>
                          )}
                        </Label>
                        <div className="flex items-center gap-1">
                          {isPromptFromLocalFile && promptFileHandleRef.current && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => reloadLocalFile("prompt")}
                              title="重新加载文件"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsExternalPromptExpanded(!isExternalPromptExpanded)}
                          >
                            {isExternalPromptExpanded ? (
                              <>
                                <ChevronUp className="mr-1 h-4 w-4" />
                                收起
                              </>
                            ) : (
                              <>
                                <ChevronDown className="mr-1 h-4 w-4" />
                                展开
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        value={loadedPromptContent}
                        readOnly
                        className={`bg-muted/50 text-sm font-mono cursor-default overflow-y-auto transition-all duration-200 ${
                          isExternalPromptExpanded ? "h-60" : "h-20"
                        }`}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      从外部加载系统提示词
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="enableSystemPromptFile"
                        checked={enableSystemPromptFile}
                        onChange={(e) => setEnableSystemPromptFile(e.target.checked)}
                        className="h-4 w-4 rounded border-input bg-background accent-primary cursor-pointer"
                      />
                      <Label htmlFor="enableSystemPromptFile" className="cursor-pointer font-normal text-sm">
                        启用
                      </Label>
                      <input
                        type="checkbox"
                        id="autoReloadSystemPrompt"
                        checked={autoReloadSystemPrompt}
                        onChange={(e) => setAutoReloadSystemPrompt(e.target.checked)}
                        disabled={!enableSystemPromptFile}
                        className="h-4 w-4 rounded border-input bg-background accent-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <Label htmlFor="autoReloadSystemPrompt" className="cursor-pointer font-normal text-sm">
                        自动重载
                      </Label>
                    </div>
                  </div>
                  {enableSystemPromptFile && (
                    <>
                      <div className="flex gap-2">
                        <Input
                          id="systemPromptFilePath"
                          value={systemPromptFilePath}
                          onChange={(e) => {
                            setSystemPromptFilePath(e.target.value)
                            setIsSystemPromptFromLocalFile(false)
                            systemPromptFileHandleRef.current = null
                            setLoadedSystemPromptContent("")
                          }}
                          placeholder="https://example.com/system-prompt.txt 或点击选择本地文件"
                          className="text-sm flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleLocalFileSelect("systemPrompt")}
                          className="shrink-0"
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          选择文件
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        支持 HTTP/HTTPS 链接或本地文件。点击"选择文件"按钮可直接选择本地 .txt 或 .md 文件。
                      </p>
                    </>
                  )}

                  {enableSystemPromptFile && loadedSystemPromptContent && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          外部加载的系统提示词预览
                          {isSystemPromptFromLocalFile && (
                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">
                              本地文件
                            </span>
                          )}
                        </Label>
                        <div className="flex items-center gap-1">
                          {isSystemPromptFromLocalFile && systemPromptFileHandleRef.current && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => reloadLocalFile("systemPrompt")}
                              title="重新加载文件"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsExternalSystemPromptExpanded(!isExternalSystemPromptExpanded)}
                          >
                            {isExternalSystemPromptExpanded ? (
                              <>
                                <ChevronUp className="mr-1 h-4 w-4" />
                                收起
                              </>
                            ) : (
                              <>
                                <ChevronDown className="mr-1 h-4 w-4" />
                                展开
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        value={loadedSystemPromptContent}
                        readOnly
                        className={`bg-muted/50 text-sm font-mono cursor-default overflow-y-auto transition-all duration-200 ${
                          isExternalSystemPromptExpanded ? "h-60" : "h-20"
                        }`}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>定时配置</Label>
                    <p className="text-xs text-muted-foreground">设置自动定时执行测试</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="timerEnabled"
                      checked={timerEnabled}
                      onChange={(e) => {
                        setTimerEnabled(e.target.checked)
                        if (!e.target.checked && isTimerRunning) {
                          stopTimer()
                        }
                      }}
                      className="h-4 w-4 rounded border-input bg-background accent-primary cursor-pointer"
                    />
                    <Label htmlFor="timerEnabled" className="cursor-pointer font-normal">
                      启用定时执行
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="timerInterval" className="text-sm text-muted-foreground whitespace-nowrap">
                      间隔时间
                    </Label>
                    <Input
                      id="timerInterval"
                      type="number"
                      value={timerInterval}
                      onChange={(e) => setTimerInterval(Math.max(1, Number(e.target.value)))}
                      className="w-20 h-8"
                      min={1}
                      disabled={!timerEnabled} // Disable input if timer is not enabled
                    />
                    <span className="text-sm text-muted-foreground">秒</span>
                  </div>
                  {isTimerRunning && (
                    <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded">
                      定时运行中 (每 {timerInterval} 秒)
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="maxTokens">Max Tokens</Label>
                    <p className="text-xs text-muted-foreground">最大生成令牌数量（范围: 1 - {maxTokensLimit}）</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{maxTokens}</span>
                    <span className="text-sm font-medium">/</span>
                    <Input
                      type="number"
                      value={maxTokensLimit}
                      onChange={(e) => {
                        const newLimit = Math.max(1, Number(e.target.value))
                        setMaxTokensLimit(newLimit)
                        if (maxTokens > newLimit) {
                          setMaxTokens(newLimit)
                        }
                      }}
                      className="w-20 h-8"
                      min={1}
                    />
                  </div>
                </div>
                <Slider
                  id="maxTokens"
                  min={1}
                  max={maxTokensLimit}
                  step={1}
                  value={[maxTokens]}
                  onValueChange={(v) => setMaxTokens(v[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="temperature">Temperature</Label>
                    <p className="text-xs text-muted-foreground">控制输出随机性，值越高越随机（范围: 0.0 - 2.0）</p>
                  </div>
                  <span className="text-sm font-medium">{temperature?.toFixed(2) ?? "1.00"}</span>
                </div>
                <Slider
                  id="temperature"
                  min={0}
                  max={2}
                  step={0.01}
                  value={[temperature]}
                  onValueChange={(v) => setTemperature(v[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="topP">Top P</Label>
                    <p className="text-xs text-muted-foreground">核采样，控制输出多样性（范围: 0.0 - 1.0）</p>
                  </div>
                  <span className="text-sm font-medium">{topP?.toFixed(2) ?? "1.00"}</span>
                </div>
                <Slider id="topP" min={0} max={1} step={0.01} value={[topP]} onValueChange={(v) => setTopP(v[0])} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="frequencyPenalty">Frequency Penalty</Label>
                    <p className="text-xs text-muted-foreground">降低重复词频率，值越大惩罚越强（范围: -2.0 - 2.0）</p>
                  </div>
                  <span className="text-sm font-medium">{frequencyPenalty?.toFixed(2) ?? "0.00"}</span>
                </div>
                <Slider
                  id="frequencyPenalty"
                  min={-2}
                  max={2}
                  step={0.01}
                  value={[frequencyPenalty]}
                  onValueChange={(v) => setFrequencyPenalty(v[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="presencePenalty">Presence Penalty</Label>
                    <p className="text-xs text-muted-foreground">
                      鼓励谈论新话题，值越大越倾向新内容（范围: -2.0 - 2.0）
                    </p>
                  </div>
                  <span className="text-sm font-medium">{presencePenalty?.toFixed(2) ?? "0.00"}</span>
                </div>
                <Slider
                  id="presencePenalty"
                  min={-2}
                  max={2}
                  step={0.01}
                  value={[presencePenalty]}
                  onValueChange={(v) => setPresencePenalty(v[0])}
                />
              </div>

              {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            </CardContent>
          )}
        </Card>

        {/* History Section - Full width */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>历史对话</CardTitle>
                <CardDescription>共 {history.length} 条记录</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRawColumns}
                    onChange={(e) => setShowRawColumns(e.target.checked)}
                    className="size-3 cursor-pointer"
                  />
                  <span>显示 Raw</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRequestContent}
                    onChange={(e) => setShowRequestContent(e.target.checked)}
                    className="size-3 cursor-pointer"
                  />
                  <span>显示请求内容</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={parseResponseMarkdown}
                    onChange={(e) => setParseResponseMarkdown(e.target.checked)}
                    className="size-3 cursor-pointer"
                  />
                  <span>解析响应markdown</span>
                </label>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 条/页</SelectItem>
                    <SelectItem value="10">10 条/页</SelectItem>
                    <SelectItem value="50">50 条/页</SelectItem>
                    <SelectItem value="100">100 条/页</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={handleClearHistory} disabled={history.length === 0}>
                  <RotateCcw className="mr-2 size-4" />
                  清空
                </Button>
                <Button variant="outline" size="sm" onClick={exportHistoryToCSV} disabled={history.length === 0}>
                  <Download className="mr-2 size-4" />
                  导出 CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">暂无历史记录</div>
            ) : (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[160px]">时间/模型/用时/上下文</TableHead>
                          {showRequestContent && (
                            <TableHead>
                              <div className="flex items-center gap-2">
                                <span>请求 Content</span>
                                <label className="flex items-center gap-1 cursor-pointer" title="展开所有请求内容">
                                  <input
                                    type="checkbox"
                                    checked={expandRequestContent}
                                    onChange={(e) => setExpandRequestContent(e.target.checked)}
                                    className="size-3 cursor-pointer"
                                  />
                                </label>
                              </div>
                            </TableHead>
                          )}
                          {showRawColumns && <TableHead className="w-[100px]">请求 Raw</TableHead>}
                          <TableHead>
                            <div className="flex items-center gap-2">
                              <span>响应 Content</span>
                              <label className="flex items-center gap-1 cursor-pointer" title="展开所有响应内容">
                                <input
                                  type="checkbox"
                                  checked={expandResponseContent}
                                  onChange={(e) => setExpandResponseContent(e.target.checked)}
                                  className="size-3 cursor-pointer"
                                />
                              </label>
                            </div>
                          </TableHead>
                          {showRawColumns && <TableHead className="w-[100px]">响应 Raw</TableHead>}
                          <TableHead className="px-4 py-3 text-center font-medium w-[80px]">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y">
                        {paginatedHistory.map((item) => {
                          const requestContentId = `request-${item.timestamp}`
                          const responseContentId = `response-${item.timestamp}`

                          // Extract images from response content (优先从 IndexedDB 加载的 base64 图片)
                          const responseImages = extractImagesFromResponseContent(
                            item.responseContent,
                            item.responseRaw,
                            responseImagesMap,
                            item.timestamp,
                          )

                          const badgeTags: string[] = []
                          if (item.tradingPair) {
                            badgeTags.push(item.tradingPair)
                          }
                          if (item.contextTags && item.contextTags.length > 0) {
                            badgeTags.push(...item.contextTags)
                          }

                          return (
                            <TableRow key={item.timestamp} className="hover:bg-muted/50">
                              <TableCell className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap align-top">
                                <div className="flex flex-col gap-1">
                                  <div>
                                    <span>
                                      {new Date(item.timestamp).toLocaleString("zh-CN", {
                                        month: "2-digit",
                                        day: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit",
                                      })}
                                    </span>
                                    <span
                                      className="font-mono text-[10px] text-foreground block truncate"
                                      title={item.model}
                                    >
                                      {item.model}
                                    </span>
                                    <span className="font-mono text-[10px]">
                                      {item.duration !== undefined && item.duration !== null ? (
                                        <>{item.duration}ms</>
                                      ) : (
                                        <span className="text-muted-foreground/50">-</span>
                                      )}
                                    </span>
                                  </div>
                                  {badgeTags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {badgeTags.map((tag, idx) => (
                                        <span
                                          key={`${item.id}-tag-${idx}`}
                                          className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              {showRequestContent && (
                                <TableCell>
                                  <div className="max-w-xl space-y-2">
                                    {(() => {
                                      const images = extractImagesFromRequestContent(item.requestContent)
                                      if (images.length > 0) {
                                        return (
                                          <div className="grid grid-cols-3 gap-1 mb-2">
                                            {images.map((imgUrl, idx) => (
                                              <div
                                                key={idx}
                                                className="relative group rounded border overflow-hidden bg-muted"
                                              >
                                                <img
                                                  src={imgUrl || "/placeholder.svg"}
                                                  alt={`Request image ${idx + 1}`}
                                                  className="w-full h-16 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                                  onClick={() =>
                                                    setZoomedImage({
                                                      id: `history-${item.timestamp}-${idx}`,
                                                      type: "url",
                                                      base64: imgUrl,
                                                    })
                                                  }
                                                />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                  <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() =>
                                                      setZoomedImage({
                                                        id: `history-${item.timestamp}-${idx}`,
                                                        type: "url",
                                                        base64: imgUrl,
                                                      })
                                                    }
                                                    title="放大查看"
                                                  >
                                                    <ZoomIn className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )
                                      }
                                      return null
                                    })()}
                                    <pre
                                      className={`text-xs whitespace-pre-wrap break-words ${
                                        !expandRequestContent && !expandedCells.has(requestContentId)
                                          ? "line-clamp-2"
                                          : ""
                                      }`}
                                    >
                                      {formatRequestContentForDisplay(item.requestContent)}
                                    </pre>
                                    {!expandRequestContent && item.requestContent.length > 100 && (
                                      <button
                                        onClick={() => toggleCellExpansion(requestContentId)}
                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                      >
                                        {expandedCells.has(requestContentId) ? (
                                          <>
                                            <ChevronUp className="size-3" />
                                            收起
                                          </>
                                        ) : (
                                          <>
                                            <ChevronDown className="size-3" />
                                            展开
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </TableCell>
                              )}

                              {showRawColumns && (
                                <TableCell className="px-4 py-3 align-top">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toggleRawVisibility(`request-raw-${item.timestamp}`)}
                                    className="h-7 text-xs"
                                  >
                                    {visibleRawCells.has(`request-raw-${item.timestamp}`) ? "隐藏" : "显示"}
                                  </Button>
                                  {visibleRawCells.has(`request-raw-${item.timestamp}`) && (
                                    <div className="mt-2 space-y-1">
                                      <pre
                                        className={`text-xs bg-muted p-2 rounded whitespace-pre-wrap break-words ${
                                          !expandAllHistory && !expandedCells.has(`request-raw-${item.timestamp}`)
                                            ? "line-clamp-2"
                                            : ""
                                        }`}
                                      >
                                        {item.requestRaw}
                                      </pre>
                                      {!expandAllHistory && item.requestRaw.length > 100 && (
                                        <button
                                          onClick={() => toggleCellExpansion(`request-raw-${item.timestamp}`)}
                                          className="text-xs text-primary hover:underline flex items-center gap-1"
                                        >
                                          {expandedCells.has(`request-raw-${item.timestamp}`) ? (
                                            <>
                                              <ChevronUp className="size-3" />
                                              收起
                                            </>
                                          ) : (
                                            <>
                                              <ChevronDown className="size-3" />
                                              展开
                                            </>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                              )}
                              <TableCell>
                                <div className="max-w-xl">
                                  <div className="text-xs whitespace-pre-wrap break-words relative">
                                    {renderContentWithCodeBlocks(
                                      item.responseContent,
                                      responseContentId,
                                      expandResponseContent || expandedCells.has(responseContentId),
                                      responseImages, // Pass extracted images
                                    )}
                                  </div>
                                  {(() => {
                                    const hasCodeBlock = item.responseContent.includes("```")
                                    const codeBlockLines = hasCodeBlock
                                      ? (item.responseContent
                                          .split("```")
                                          .filter((_, i) => i % 2 === 1)[0]
                                          ?.split("\n")?.length ?? 0)
                                      : 0
                                    const shouldShowToggle =
                                      item.responseContent.length > 100 || (hasCodeBlock && codeBlockLines > 3)
                                    return (
                                      !expandResponseContent &&
                                      shouldShowToggle && (
                                        <button
                                          onClick={() => toggleCellExpansion(responseContentId)}
                                          className="text-xs text-primary hover:underline flex items-center gap-1"
                                        >
                                          {expandedCells.has(responseContentId) ? (
                                            <>
                                              <ChevronUp className="size-3" />
                                              收起
                                            </>
                                          ) : (
                                            <>
                                              <ChevronDown className="size-3" />
                                              展开
                                            </>
                                          )}
                                        </button>
                                      )
                                    )
                                  })()}
                                </div>
                              </TableCell>

                              {showRawColumns && (
                                <TableCell className="px-4 py-3 align-top">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toggleRawVisibility(`response-raw-${item.timestamp}`)}
                                    className="h-7 text-xs"
                                  >
                                    {visibleRawCells.has(`response-raw-${item.timestamp}`) ? "隐藏" : "显示"}
                                  </Button>
                                  {visibleRawCells.has(`response-raw-${item.timestamp}`) && (
                                    <div className="mt-2 space-y-1">
                                      <pre
                                        className={`text-xs bg-muted p-2 rounded whitespace-pre-wrap break-words ${
                                          !expandAllHistory && !expandedCells.has(`response-raw-${item.timestamp}`)
                                            ? "line-clamp-2"
                                            : ""
                                        }`}
                                      >
                                        {item.responseRaw}
                                      </pre>
                                      {!expandAllHistory && item.responseRaw.length > 100 && (
                                        <button
                                          onClick={() => toggleCellExpansion(`response-raw-${item.timestamp}`)}
                                          className="text-xs text-primary hover:underline flex items-center gap-1"
                                        >
                                          {expandedCells.has(`response-raw-${item.timestamp}`) ? (
                                            <>
                                              <ChevronUp className="size-3" />
                                              收起
                                            </>
                                          ) : (
                                            <>
                                              <ChevronDown className="size-3" />
                                              展开
                                            </>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                              )}
                              <TableCell className="px-4 py-3 text-center align-top">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteHistoryItem(item.id)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      下一页
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Request and Response Details - Side by side */}
        <div className="grid grid-cols-2 gap-6">
          <Card className="flex flex-col h-[600px]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>请求详情</CardTitle>
                  <CardDescription>完整的 cURL 命令（包含明文 API Key）</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => requestData && handleCopy(requestData, "request")}
                  disabled={!requestData}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  {requestCopyText}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <div className="h-full overflow-auto rounded-lg bg-muted p-4">
                <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
                  {requestData || '点击"开始测试"查看 cURL 命令...'}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col h-[600px]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>响应详情</CardTitle>
                  <CardDescription>API 返回的完整响应</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {responseDuration !== null && (
                    <div className="text-xs text-muted-foreground font-mono">用时: {responseDuration}ms</div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (responseData) {
                        const cleanedResponse = responseData
                          .split("\n")
                          .filter((line) => line.trim() !== "")
                          .join("\n")
                        handleCopy(cleanedResponse, "response")
                      }
                    }}
                    disabled={!responseData}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    {responseCopyText}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <div className="h-full overflow-auto rounded-lg bg-muted p-4">
                <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
                  {responseData
                    ? responseData
                        .split("\n")
                        .filter((line) => line.trim() !== "")
                        .join("\n")
                    : "等待响应..."}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={!!zoomedImage} onOpenChange={(open) => !open && setZoomedImage(null)}>
        <DialogContent className="max-w-5xl w-full p-0 overflow-hidden">
          {zoomedImage && (
            <div className="relative w-full flex flex-col">
              <div className="flex-1 flex items-center justify-center bg-black/90 p-4">
                <img
                  src={zoomedImage.base64 || zoomedImage.url}
                  alt={zoomedImage.name || "Zoomed Image"}
                  className="max-w-full max-h-[80vh] object-contain"
                />
              </div>
              <div className="bg-background border-t p-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{zoomedImage.name || "未命名图片"}</p>
                  {zoomedImage.type === "url" && zoomedImage.url && (
                    <p className="text-xs text-muted-foreground truncate">{zoomedImage.url}</p>
                  )}
                  {zoomedImage.type === "file" && <p className="text-xs text-muted-foreground">本地上传图片</p>}
                </div>
                <Button variant="outline" size="sm" onClick={() => setZoomedImage(null)}>
                  关闭
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  )
}
