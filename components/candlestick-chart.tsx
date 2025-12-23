"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  createChart,
  CandlestickSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
  type SeriesMarker,
  type ISeriesMarkersPluginApi,
  LineSeries,
} from "lightweight-charts"
import { Loader2, Pencil, List, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { IndicatorsDropdown, type IndicatorConfig } from "@/components/indicators-dropdown"
import {
  calculateMA,
  calculateEMA,
  calculateMACD,
  calculateBOLL,
  calculateRSI,
  calculateKDJ,
  calculateATR,
  calculateVWAP,
  calculateOBV,
  calculateMFI,
  calculateVPT,
} from "@/lib/indicators"
import type { KlineData } from "@/lib/types"

type MarketType = "crypto" | "stock"

// Default crypto pairs fallback
const DEFAULT_CRYPTO_PAIRS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "SOLUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "DOTUSDT",
  "MATICUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "LTCUSDT",
  "ATOMUSDT",
  "UNIUSDT",
  "XLMUSDT",
  "FILUSDT",
  "AAVEUSDT",
  "ALGOUSDT",
  "APTUSDT",
  "ARBUSDT",
  "NEARUSDT",
  "OPUSDT",
  "PEPEUSDT",
  "SHIBUSDT",
  "WIFUSDT",
  "SUIUSDT",
  "TIAUSDT",
  "JUPUSDT",
  "ENAUSDT",
]

// Default stock tickers fallback (S&P 500 top stocks)
const DEFAULT_STOCK_TICKERS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "NVDA",
  "META",
  "TSLA",
  "BRK.B",
  "UNH",
  "JNJ",
  "JPM",
  "V",
  "PG",
  "XOM",
  "HD",
  "CVX",
  "MA",
  "ABBV",
  "MRK",
  "LLY",
  "PFE",
  "KO",
  "PEP",
  "COST",
  "AVGO",
  "TMO",
  "WMT",
  "MCD",
  "CSCO",
  "ACN",
  "ABT",
  "DHR",
  "CRM",
  "VZ",
  "ADBE",
  "NKE",
  "INTC",
  "CMCSA",
  "TXN",
  "NEE",
  "AMD",
  "PM",
  "ORCL",
  "HON",
  "UPS",
  "BMY",
  "QCOM",
  "LOW",
  "MS",
  "CAT",
]

const STORAGE_KEYS = {
  CRYPTO_PAIRS: "kline_crypto_pairs",
  STOCK_TICKERS: "kline_stock_tickers",
  CRYPTO_PAIRS_TIMESTAMP: "kline_crypto_pairs_timestamp",
  STOCK_TICKERS_TIMESTAMP: "kline_stock_tickers_timestamp",
  MARKET_TYPE: "kline_market_type",
}

// Cache validity: 24 hours
const CACHE_VALIDITY_MS = 24 * 60 * 60 * 1000

interface CandlestickChartProps {
  data: KlineData[]
  onCandleClick?: (data: KlineData[], clickedCandle: KlineData) => void
  isLoading?: boolean
  tradingPair: string
  onTradingPairChange: (pair: string) => void
  klineInterval: string
  onIntervalChange: (interval: string) => void
  popularPairs: string[]
  intervals: Array<{ value: string; label: string }>
  onTimePointChange?: (timestamp: number) => void
  endTime?: number
  limit?: number
  onLimitChange?: (limit: number) => void
  onForceReload?: () => void
  markedCandleTime: number | null
  onMarkedCandleTimeChange?: (time: number | null) => void
  onIndicatorsChange?: (indicators: IndicatorConfig[]) => void
}

export function CandlestickChart({
  data,
  onCandleClick,
  isLoading,
  tradingPair,
  onTradingPairChange,
  klineInterval,
  onIntervalChange,
  popularPairs,
  intervals,
  onTimePointChange,
  endTime,
  limit = 100,
  onLimitChange,
  onForceReload,
  markedCandleTime: externalMarkedCandleTime,
  onMarkedCandleTimeChange,
  onIndicatorsChange,
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const indicatorSeriesRef = useRef<Map<number, ISeriesApi<"Line">>>(new Map())
  const [tradingPairSearch, setTradingPairSearch] = useState("")

  const [marketType, setMarketType] = useState<MarketType>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEYS.MARKET_TYPE)
      return (saved as MarketType) || "crypto"
    }
    return "crypto"
  })

  const [cryptoPairs, setCryptoPairs] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEYS.CRYPTO_PAIRS)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return DEFAULT_CRYPTO_PAIRS
        }
      }
    }
    return DEFAULT_CRYPTO_PAIRS
  })

  const [stockTickers, setStockTickers] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEYS.STOCK_TICKERS)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return DEFAULT_STOCK_TICKERS
        }
      }
    }
    return DEFAULT_STOCK_TICKERS
  })

  const [pairsLoading, setPairsLoading] = useState(false)
  const [manualInput, setManualInput] = useState("")
  const [isCustomPair, setIsCustomPair] = useState(false)

  const [activeIndicators, setActiveIndicators] = useState<IndicatorConfig[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("klineActiveIndicators")
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (error) {
          console.error("[v0] Failed to parse saved indicators:", error)
          return []
        }
      }
    }
    return []
  })

  const [customInterval, setCustomInterval] = useState("")
  const [isCustomInterval, setIsCustomInterval] = useState(false)

  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("klineSelectedDate")
      return saved || ""
    }
    return ""
  })

  const [selectedTime, setSelectedTime] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("klineSelectedTime")
      return saved || ""
    }
    return ""
  })

  const [internalMarkedCandleTime, setInternalMarkedCandleTime] = useState<number | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("markedCandleTime")
      return saved ? Number.parseInt(saved) : null
    }
    return null
  })

  const markedCandleTime = externalMarkedCandleTime !== undefined ? externalMarkedCandleTime : internalMarkedCandleTime
  const setMarkedCandleTime = onMarkedCandleTimeChange || setInternalMarkedCandleTime
  const [markerTime, setMarkerTime] = useState<number | null>(null)

  const normalizeToSeconds = useCallback((timestamp: number) => Math.floor(timestamp / 1000), [])

  useEffect(() => {
    if (!chartContainerRef.current) return

    const initChart = () => {
      if (!chartContainerRef.current) return

      const containerWidth = chartContainerRef.current.offsetWidth
      if (containerWidth === 0) {
        setTimeout(initChart, 100)
        return
      }

      const chart = createChart(chartContainerRef.current, {
        width: containerWidth,
        height: 400,
        layout: {
          background: { color: "transparent" },
          textColor: "#9ca3af",
        },
        grid: {
          vertLines: { color: "rgba(156, 163, 175, 0.1)" },
          horzLines: { color: "rgba(156, 163, 175, 0.1)" },
        },
        timeScale: {
          timeVisible: true,
          borderVisible: false,
          tickMarkFormatter: (time: number) => {
            const date = new Date(time * 1000)
            const utc8Date = new Date(date.getTime() + 8 * 60 * 60 * 1000)
            const month = String(utc8Date.getUTCMonth() + 1).padStart(2, "0")
            const day = String(utc8Date.getUTCDate()).padStart(2, "0")
            const hours = String(utc8Date.getUTCHours()).padStart(2, "0")
            const minutes = String(utc8Date.getUTCMinutes()).padStart(2, "0")
            return `${month}-${day} ${hours}:${minutes}`
          },
        },
        rightPriceScale: {
          borderVisible: false,
        },
        crosshair: {
          mode: 1,
        },
        localization: {
          timeFormatter: (time: number) => {
            const date = new Date(time * 1000)
            const utc8Date = new Date(date.getTime() + 8 * 60 * 60 * 1000)
            const year = utc8Date.getUTCFullYear()
            const month = String(utc8Date.getUTCMonth() + 1).padStart(2, "0")
            const day = String(utc8Date.getUTCDate()).padStart(2, "0")
            const hours = String(utc8Date.getUTCHours()).padStart(2, "0")
            const minutes = String(utc8Date.getUTCMinutes()).padStart(2, "0")
            const seconds = String(utc8Date.getUTCSeconds()).padStart(2, "0")
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
          },
        },
      })

      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#10b981",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#10b981",
        wickDownColor: "#ef4444",
      })

      const markersPlugin = createSeriesMarkers(candlestickSeries)

      chartRef.current = chart
      candlestickSeriesRef.current = candlestickSeries
      markersPluginRef.current = markersPlugin
    }

    const timer = setTimeout(initChart, 50)

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.offsetWidth,
        })
      }
    }

    window.addEventListener("resize", handleResize)

    return () => {
      clearTimeout(timer)
      window.removeEventListener("resize", handleResize)
      if (markersPluginRef.current) {
        markersPluginRef.current.detach()
        markersPluginRef.current = null
      }
      indicatorSeriesRef.current.forEach((series) => {
        if (chartRef.current) {
          chartRef.current.removeSeries(series)
        }
      })
      indicatorSeriesRef.current.clear()
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        candlestickSeriesRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (candlestickSeriesRef.current && data.length > 0) {
      const chartData: CandlestickData[] = data.map((item) => ({
        time: normalizeToSeconds(item.time) as Time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }))

      candlestickSeriesRef.current.setData(chartData)

      if (chartRef.current) {
        chartRef.current.timeScale().fitContent()
      }
    }
  }, [data, normalizeToSeconds])

  useEffect(() => {
    if (!markersPluginRef.current) return

    if (markerTime !== null) {
      const hasMatchingCandle = data.some((item) => normalizeToSeconds(item.time) === markerTime)
      if (hasMatchingCandle) {
        const markers: SeriesMarker<Time>[] = [
          {
            time: markerTime as Time,
            position: "aboveBar",
            color: "#000000",
            shape: "arrowDown",
            text: "已选",
          },
        ]
        markersPluginRef.current.setMarkers(markers)
        return
      }
    }

    markersPluginRef.current.setMarkers([])
  }, [markerTime, data, normalizeToSeconds])

  useEffect(() => {
    if (markedCandleTime === null) {
      setMarkerTime(null)
      return
    }

    const markedCandle = data.find((item) => item.time === markedCandleTime)
    if (markedCandle) {
      setMarkerTime(normalizeToSeconds(markedCandle.time))
    } else {
      setMarkerTime(null)
    }
  }, [markedCandleTime, data, normalizeToSeconds])

  useEffect(() => {
    if (!chartRef.current || !onCandleClick) return

    const handleClick = (param: any) => {
      if (!param.time) return

      const clickedTime = param.time as number
      const clickedIndex = data.findIndex((item) => normalizeToSeconds(item.time) === clickedTime)

      if (clickedIndex >= 0) {
        const clickedCandle = data[clickedIndex]
        const dataBeforeClick = data.slice(0, clickedIndex + 1)

        console.log("[v0] Candle clicked, time:", clickedCandle.time)

        setMarkedCandleTime(clickedCandle.time)
        setMarkerTime(clickedTime)

        onCandleClick(dataBeforeClick, clickedCandle)
      }
    }

    chartRef.current.subscribeClick(handleClick)

    return () => {
      if (chartRef.current) {
        chartRef.current.unsubscribeClick(handleClick)
      }
    }
  }, [data, onCandleClick, normalizeToSeconds, setMarkedCandleTime])

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (selectedDate) {
        localStorage.setItem("klineSelectedDate", selectedDate)
      } else {
        localStorage.removeItem("klineSelectedDate")
      }
    }
  }, [selectedDate])

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (selectedTime) {
        localStorage.setItem("klineSelectedTime", selectedTime)
      } else {
        localStorage.removeItem("klineSelectedTime")
      }
    }
  }, [selectedTime])

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (markedCandleTime !== null) {
        localStorage.setItem("markedCandleTime", markedCandleTime.toString())
      } else {
        localStorage.removeItem("markedCandleTime")
      }
    }
  }, [markedCandleTime])

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (activeIndicators.length > 0) {
        localStorage.setItem("klineActiveIndicators", JSON.stringify(activeIndicators))
      } else {
        localStorage.removeItem("klineActiveIndicators")
      }
    }
  }, [activeIndicators])

  useEffect(() => {
    onIndicatorsChange?.(activeIndicators)
  }, [activeIndicators, onIndicatorsChange])

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return

    // Remove old indicator series
    indicatorSeriesRef.current.forEach((series) => {
      if (chartRef.current) {
        chartRef.current.removeSeries(series)
      }
    })
    indicatorSeriesRef.current.clear()

    // Add new indicator series
    activeIndicators.forEach((indicator, index) => {
      if (!chartRef.current || !indicator.visible) return

      if (indicator.type === "MA" && indicator.params.period) {
        const maData = calculateMA(data, indicator.params.period)
        const series = chartRef.current.addSeries(LineSeries, {
          color: indicator.params.color || "#2563eb",
          lineWidth: 2,
          title: `MA(${indicator.params.period})`,
        })
        series.setData(
          maData.map((item) => ({
            time: (item.time / 1000) as Time,
            value: item.value,
          })),
        )
        indicatorSeriesRef.current.set(index, series)
      } else if (indicator.type === "EMA" && indicator.params.period) {
        const emaData = calculateEMA(data, indicator.params.period)
        const series = chartRef.current.addSeries(LineSeries, {
          color: indicator.params.color || "#f59e0b",
          lineWidth: 2,
          title: `EMA(${indicator.params.period})`,
        })
        series.setData(
          emaData.map((item) => ({
            time: (item.time / 1000) as Time,
            value: item.value,
          })),
        )
        indicatorSeriesRef.current.set(index, series)
      } else if (
        indicator.type === "MACD" &&
        indicator.params.fastPeriod &&
        indicator.params.slowPeriod &&
        indicator.params.signalPeriod
      ) {
        const macdData = calculateMACD(
          data,
          indicator.params.fastPeriod,
          indicator.params.slowPeriod,
          indicator.params.signalPeriod,
        )

        // MACD line
        const macdSeries = chartRef.current.addSeries(LineSeries, {
          color: "#2563eb",
          lineWidth: 2,
          title: "MACD",
          priceScaleId: "macd",
        })
        macdSeries.setData(
          macdData.map((item) => ({
            time: (item.time / 1000) as Time,
            value: item.macd,
          })),
        )
        indicatorSeriesRef.current.set(index * 3, macdSeries)

        // Signal line
        const signalSeries = chartRef.current.addSeries(LineSeries, {
          color: "#f59e0b",
          lineWidth: 2,
          title: "Signal",
          priceScaleId: "macd",
        })
        signalSeries.setData(
          macdData.map((item) => ({
            time: (item.time / 1000) as Time,
            value: item.signal,
          })),
        )
        indicatorSeriesRef.current.set(index * 3 + 1, signalSeries)
      } else if (indicator.type === "BOLL" && indicator.params.period && indicator.params.stdDev) {
        const bollData = calculateBOLL(data, indicator.params.period, indicator.params.stdDev)

        // Upper band
        const upperSeries = chartRef.current.addSeries(LineSeries, {
          color: "#8b5cf6",
          lineWidth: 1,
          lineStyle: 2, // Dashed
          title: "BOLL Upper",
        })
        upperSeries.setData(
          bollData.map((item) => ({
            time: (item.time / 1000) as Time,
            value: item.upper,
          })),
        )
        indicatorSeriesRef.current.set(index * 3, upperSeries)

        // Middle band
        const middleSeries = chartRef.current.addSeries(LineSeries, {
          color: "#8b5cf6",
          lineWidth: 2,
          title: "BOLL Middle",
        })
        middleSeries.setData(
          bollData.map((item) => ({
            time: (item.time / 1000) as Time,
            value: item.middle,
          })),
        )
        indicatorSeriesRef.current.set(index * 3 + 1, middleSeries)

        // Lower band
        const lowerSeries = chartRef.current.addSeries(LineSeries, {
          color: "#8b5cf6",
          lineWidth: 1,
          lineStyle: 2, // Dashed
          title: "BOLL Lower",
        })
        lowerSeries.setData(
          bollData.map((item) => ({
            time: (item.time / 1000) as Time,
            value: item.lower,
          })),
        )
        indicatorSeriesRef.current.set(index * 3 + 2, lowerSeries)
      } else if (indicator.type === "RSI" && indicator.params.period) {
        const rsiData = calculateRSI(data, indicator.params.period)
        const series = chartRef.current.addSeries(LineSeries, {
          color: indicator.params.color || "#ec4899",
          lineWidth: 2,
          title: `RSI(${indicator.params.period})`,
          priceScaleId: "rsi",
        })
        series.setData(
          rsiData.map((item) => ({
            time: (item.time / 1000) as Time,
            value: item.value,
          })),
        )
        indicatorSeriesRef.current.set(index, series)
      } else if (indicator.type === "KDJ" && indicator.params.period) {
        const kdjData = calculateKDJ(
          data,
          indicator.params.period,
          indicator.params.kPeriod || 3,
          indicator.params.dPeriod || 3,
        )

        // K line
        const kSeries = chartRef.current.addSeries(LineSeries, {
          color: "#2563eb",
          lineWidth: 2,
          title: "K",
          priceScaleId: "kdj",
        })
        kSeries.setData(
          kdjData.map((item) => ({
            time: (item.time / 1000) as Time,
            value: item.k,
          })),
        )
        indicatorSeriesRef.current.set(index * 3, kSeries)

        // D line
        const dSeries = chartRef.current.addSeries(LineSeries, {
          color: "#f59e0b",
          lineWidth: 2,
          title: "D",
          priceScaleId: "kdj",
        })
        dSeries.setData(
          kdjData.map((item) => ({
            time: (item.time / 1000) as Time,
            value: item.d,
          })),
        )
        indicatorSeriesRef.current.set(index * 3 + 1, dSeries)

        // J line
        const jSeries = chartRef.current.addSeries(LineSeries, {
          color: "#ec4899",
          lineWidth: 2,
          title: "J",
          priceScaleId: "kdj",
        })
        jSeries.setData(
          kdjData.map((item) => ({
            time: (item.time / 1000) as Time,
            value: item.j,
          })),
        )
        indicatorSeriesRef.current.set(index * 3 + 2, jSeries)
      } else if (indicator.type === "ATR" && indicator.params.period) {
        const atrData = calculateATR(data, indicator.params.period)
        const series = chartRef.current.addSeries(LineSeries, {
          color: indicator.params.color || "#06b6d4",
          lineWidth: 2,
          title: `ATR(${indicator.params.period})`,
          priceScaleId: "atr",
        })
        series.setData(
          atrData.map((item) => ({
            time: (item.time / 1000) as Time,
            value: item.value,
          })),
        )
        indicatorSeriesRef.current.set(index, series)
      } else if (indicator.type === "VOL") {
        // VOL series
        const volData = data.map((item) => ({
          time: (item.time / 1000) as Time,
          value: item.volume,
        }))
        const series = chartRef.current.addSeries(LineSeries, {
          color: "#6366f1",
          lineWidth: 2,
          title: "VOL",
          priceScaleId: "vol",
        })
        series.setData(volData)
        indicatorSeriesRef.current.set(index, series)
      } else if (indicator.type === "VWAP") {
        const vwapData = calculateVWAP(data)
        const series = chartRef.current.addSeries(LineSeries, {
          color: "#10b981",
          lineWidth: 2,
          title: "VWAP",
        })
        series.setData(
          vwapData.map((item) => ({
            time: (item.time / 1000) as Time,
            value: item.value,
          })),
        )
        indicatorSeriesRef.current.set(index, series)
      } else if (indicator.type === "OBV") {
        const obvData = calculateOBV(data)
        const series = chartRef.current.addSeries(LineSeries, {
          color: "#6366f1",
          lineWidth: 2,
          title: "OBV",
          priceScaleId: "obv",
        })
        series.setData(
          obvData.map((item) => ({
            time: (item.time / 1000) as Time,
            value: item.value,
          })),
        )
        indicatorSeriesRef.current.set(index, series)
      } else if (indicator.type === "MFI" && indicator.params.period) {
        const mfiData = calculateMFI(data, indicator.params.period)
        const series = chartRef.current.addSeries(LineSeries, {
          color: indicator.params.color || "#84cc16",
          lineWidth: 2,
          title: `MFI(${indicator.params.period})`,
          priceScaleId: "mfi",
        })
        series.setData(
          mfiData.map((item) => ({
            time: (item.time / 1000) as Time,
            value: item.value,
          })),
        )
        indicatorSeriesRef.current.set(index, series)
      } else if (indicator.type === "VPT") {
        const vptData = calculateVPT(data)
        const series = chartRef.current.addSeries(LineSeries, {
          color: "#a855f7",
          lineWidth: 2,
          title: "VPT",
          priceScaleId: "vpt",
        })
        series.setData(
          vptData.map((item) => ({
            time: (item.time / 1000) as Time,
            value: item.value,
          })),
        )
        indicatorSeriesRef.current.set(index, series)
      }
    })
  }, [data, activeIndicators])

  const handleAddIndicator = (config: IndicatorConfig) => {
    setActiveIndicators((prev) => [...prev, config])
  }

  const handleToggleIndicator = (index: number) => {
    setActiveIndicators((prev) =>
      prev.map((indicator, i) => (i === index ? { ...indicator, visible: !indicator.visible } : indicator)),
    )
  }

  const handleRemoveIndicator = (index: number) => {
    setActiveIndicators((prev) => prev.filter((_, i) => i !== index))
  }

  const fetchCryptoPairs = useCallback(async () => {
    // Check cache first
    const cachedTimestamp = localStorage.getItem(STORAGE_KEYS.CRYPTO_PAIRS_TIMESTAMP)
    if (cachedTimestamp && Date.now() - Number.parseInt(cachedTimestamp) < CACHE_VALIDITY_MS) {
      return // Use cached data
    }

    setPairsLoading(true)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

      const response = await fetch("https://api.binance.com/api/v3/ticker/price", {
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) throw new Error("Failed to fetch")

      const data = await response.json()
      const pairs = data
        .map((item: { symbol: string }) => item.symbol)
        .filter((symbol: string) => symbol.endsWith("USDT") || symbol.endsWith("BTC") || symbol.endsWith("ETH"))
        .sort()

      if (pairs.length > 0) {
        setCryptoPairs(pairs)
        localStorage.setItem(STORAGE_KEYS.CRYPTO_PAIRS, JSON.stringify(pairs))
        localStorage.setItem(STORAGE_KEYS.CRYPTO_PAIRS_TIMESTAMP, Date.now().toString())
      }
    } catch (error) {
      console.error("[v0] Failed to fetch crypto pairs, using defaults:", error)
      // Keep using current pairs (either cached or defaults)
    } finally {
      setPairsLoading(false)
    }
  }, [])

  const fetchStockTickers = useCallback(async () => {
    // Check cache first
    const cachedTimestamp = localStorage.getItem(STORAGE_KEYS.STOCK_TICKERS_TIMESTAMP)
    if (cachedTimestamp && Date.now() - Number.parseInt(cachedTimestamp) < CACHE_VALIDITY_MS) {
      return // Use cached data
    }

    setPairsLoading(true)
    const csvUrl = "https://raw.githubusercontent.com/shashankvemuri/Finance/refs/heads/master/s%26p500_tickers.csv"

    // Try with CORS proxy
    const proxyUrls = [
      `https://cloudflare-proxy.xiechengqi.top/${csvUrl}`,
      `https://thingproxy.freeboard.io/fetch/${csvUrl}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(csvUrl)}`,
    ]

    for (const proxyUrl of proxyUrls) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

        const response = await fetch(proxyUrl, { signal: controller.signal })
        clearTimeout(timeoutId)

        if (!response.ok) continue

        const csvText = await response.text()
        // Parse CSV - each line is a ticker
        const tickers = csvText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.toLowerCase().includes("ticker") && /^[A-Z.]+$/.test(line))
          .sort()

        if (tickers.length > 0) {
          setStockTickers(tickers)
          localStorage.setItem(STORAGE_KEYS.STOCK_TICKERS, JSON.stringify(tickers))
          localStorage.setItem(STORAGE_KEYS.STOCK_TICKERS_TIMESTAMP, Date.now().toString())
          setPairsLoading(false)
          return
        }
      } catch (error) {
        console.error("[v0] Proxy failed:", proxyUrl, error)
        continue
      }
    }

    console.error("[v0] All proxies failed for stock tickers, using defaults")
    setPairsLoading(false)
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MARKET_TYPE, marketType)
    if (marketType === "crypto") {
      fetchCryptoPairs()
    } else {
      fetchStockTickers()
    }
  }, [marketType, fetchCryptoPairs, fetchStockTickers])

  const displayPairs = marketType === "crypto" ? cryptoPairs : stockTickers.map((t) => `STOCK:${t}`)

  const handleManualInputSubmit = () => {
    if (manualInput.trim()) {
      const pair =
        marketType === "stock" && !manualInput.startsWith("STOCK:")
          ? `STOCK:${manualInput.trim().toUpperCase()}`
          : manualInput.trim().toUpperCase()
      onTradingPairChange(pair)
      setManualInput("")
    }
  }

  const handleReload = () => {
    if (onForceReload) {
      onForceReload()
    }
  }

  return (
    <div className="space-y-4">
      {markedCandleTime && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
          <span className="text-black dark:text-white">●</span>
          <span>已选中蜡烛: {new Date(markedCandleTime).toLocaleString()}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 ml-auto"
            onClick={() => {
              console.log("[v0] Clear marker button clicked")
              setMarkedCandleTime(null)
            }}
          >
            清除标记
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* Market type selector */}
        <Select value={marketType} onValueChange={(value: MarketType) => setMarketType(value)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="crypto">加密货币</SelectItem>
            <SelectItem value="stock">美股</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          {!isCustomPair ? (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-[160px] justify-between bg-transparent">
                    {pairsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="truncate">{tradingPair}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="搜索交易对..."
                      value={tradingPairSearch}
                      onValueChange={setTradingPairSearch}
                    />
                    <CommandList>
                      <CommandEmpty>未找到交易对</CommandEmpty>
                      <CommandGroup>
                        {displayPairs
                          .filter((pair) => pair.toLowerCase().includes(tradingPairSearch.toLowerCase()))
                          .slice(0, 100)
                          .map((pair) => (
                            <CommandItem
                              key={pair}
                              value={pair}
                              onSelect={() => {
                                onTradingPairChange(pair)
                                setTradingPairSearch("")
                              }}
                            >
                              {pair}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setIsCustomPair(true)}
                title="手动输入交易对"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Input
                placeholder={marketType === "crypto" ? "输入交易对 如 BTCUSDT" : "输入股票代码 如 AAPL"}
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleManualInputSubmit()
                    setIsCustomPair(false)
                  }
                }}
                className="w-[180px]"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setIsCustomPair(false)}
                title="从列表选择"
              >
                <List className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Interval selection */}
        <div className="flex items-center gap-2">
          <Select
            value={isCustomInterval ? "custom" : klineInterval}
            onValueChange={(value) => {
              if (value === "custom") {
                setIsCustomInterval(true)
              } else {
                setIsCustomInterval(false)
                onIntervalChange(value)
              }
            }}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue>
                {isCustomInterval ? "自定义" : intervals.find((i) => i.value === klineInterval)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {intervals.map((interval) => (
                <SelectItem key={interval.value} value={interval.value}>
                  {interval.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">自定义周期</SelectItem>
            </SelectContent>
          </Select>

          {isCustomInterval && (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="如: 30m, 2h, 1d"
                value={customInterval}
                onChange={(e) => setCustomInterval(e.target.value)}
                className="w-[120px] h-9"
              />
              <Button size="sm" onClick={() => onIntervalChange(customInterval.trim())} variant="outline">
                应用
              </Button>
            </div>
          )}
        </div>

        {/* Limit selection */}
        <Select
          value={limit.toString()}
          onValueChange={(value) => {
            const newLimit = Number.parseInt(value)
            if (onLimitChange) {
              onLimitChange(newLimit)
            }
          }}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue>{limit} 个周期</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50 个周期</SelectItem>
            <SelectItem value="100">100 个周期</SelectItem>
            <SelectItem value="200">200 个周期</SelectItem>
            <SelectItem value="500">500 个周期</SelectItem>
            <SelectItem value="1000">1000 个周期</SelectItem>
          </SelectContent>
        </Select>

        {/* Date time selection and reload button */}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-[150px] h-9"
          />
          <Input
            type="time"
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            className="w-[120px] h-9"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedDate("")
              setSelectedTime("")
              localStorage.removeItem("klineSelectedDate")
              localStorage.removeItem("klineSelectedTime")
            }}
            className="h-9 px-3 bg-transparent"
            title="清除日期时间"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReload}
            disabled={isLoading}
            className="h-9 px-3 bg-transparent"
            title="重新加载"
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="flex items-center">
        <IndicatorsDropdown
          onAddIndicator={handleAddIndicator}
          activeIndicators={activeIndicators}
          onToggleIndicator={handleToggleIndicator}
          onRemoveIndicator={handleRemoveIndicator}
        />
      </div>

      <div className="relative w-full min-h-[400px]">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        <div ref={chartContainerRef} className="w-full" />
      </div>
    </div>
  )
}
