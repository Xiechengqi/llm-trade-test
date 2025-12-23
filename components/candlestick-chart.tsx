"use client"

import { useEffect, useRef, useState } from "react"
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
import { Loader2 } from "lucide-react"
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

export interface KlineData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

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
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const indicatorSeriesRef = useRef<Map<number, ISeriesApi<"Line">>>(new Map())
  const [tradingPairSearch, setTradingPairSearch] = useState("")

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
        time: (item.time / 1000) as Time,
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
  }, [data])

  useEffect(() => {
    if (!markersPluginRef.current) return

    if (markedCandleTime !== null) {
      const markedCandle = data.find((item) => item.time === markedCandleTime)
      if (markedCandle) {
        console.log("[v0] Setting marker for time:", markedCandleTime)
        const markers: SeriesMarker<Time>[] = [
          {
            time: (markedCandleTime / 1000) as Time,
            position: "aboveBar",
            color: "#000000",
            shape: "arrowDown",
            text: "已选",
          },
        ]
        markersPluginRef.current.setMarkers(markers)
      } else {
        console.log("[v0] Clearing markers - candle not found")
        markersPluginRef.current.setMarkers([])
      }
    } else {
      console.log("[v0] Clearing markers - markedCandleTime is null")
      markersPluginRef.current.setMarkers([])
    }
  }, [markedCandleTime, data])

  useEffect(() => {
    if (!chartRef.current || !onCandleClick) return

    const handleClick = (param: any) => {
      if (!param.time) return

      const clickedTime = param.time as number
      const clickedIndex = data.findIndex((item) => item.time / 1000 === clickedTime)

      if (clickedIndex >= 0) {
        const clickedCandle = data[clickedIndex]
        const dataBeforeClick = data.slice(0, clickedIndex + 1)

        console.log("[v0] Candle clicked, time:", clickedCandle.time)

        setMarkedCandleTime(clickedCandle.time)

        onCandleClick(dataBeforeClick, clickedCandle)
      }
    }

    chartRef.current.subscribeClick(handleClick)

    return () => {
      if (chartRef.current) {
        chartRef.current.unsubscribeClick(handleClick)
      }
    }
  }, [data, onCandleClick])

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

      <IndicatorsDropdown
        onAddIndicator={handleAddIndicator}
        activeIndicators={activeIndicators}
        onToggleIndicator={handleToggleIndicator}
        onRemoveIndicator={handleRemoveIndicator}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[140px] justify-between bg-transparent">
              <span className="truncate">{tradingPair}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <Command>
              <CommandInput
                placeholder="搜索交易对..."
                value={tradingPairSearch}
                onValueChange={setTradingPairSearch}
              />
              <CommandList>
                <CommandEmpty>未找到交易对</CommandEmpty>
                <CommandGroup>
                  {popularPairs
                    .filter((pair) => pair.toLowerCase().includes(tradingPairSearch.toLowerCase()))
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
            onClick={() => {
              let timestamp: number

              if (!selectedDate && !selectedTime) {
                // Use current time if both fields are empty
                timestamp = Date.now()
              } else if (selectedDate && selectedTime) {
                // Use selected date and time
                const datetime = `${selectedDate}T${selectedTime}`
                timestamp = new Date(datetime).getTime()
              } else {
                // If only one field is filled, don't set timestamp
                timestamp = 0
              }

              if (timestamp > 0 && onTimePointChange) {
                onTimePointChange(timestamp)
              }

              if (onForceReload) {
                onForceReload()
              }
            }}
            disabled={isLoading}
            className="h-9 px-3 bg-transparent"
            title="重载图表数据"
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
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          </Button>
        </div>
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
