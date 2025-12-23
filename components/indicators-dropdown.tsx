"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff, X } from "lucide-react"

export interface IndicatorConfig {
  type: "MA" | "EMA" | "MACD" | "BOLL" | "RSI" | "KDJ" | "ATR" | "VOL" | "VWAP" | "OBV" | "MFI" | "VPT"
  visible: boolean
  params: {
    // For MA/EMA
    period?: number
    color?: string
    // For MACD
    fastPeriod?: number
    slowPeriod?: number
    signalPeriod?: number
    // For BOLL
    stdDev?: number
    // For KDJ
    kPeriod?: number
    dPeriod?: number
  }
}

interface IndicatorsDropdownProps {
  onAddIndicator: (config: IndicatorConfig) => void
  activeIndicators: IndicatorConfig[]
  onToggleIndicator: (index: number) => void
  onRemoveIndicator: (index: number) => void
}

const INDICATOR_CATEGORIES = {
  trend: [
    { value: "MA", label: "MA - 移动平均线", description: "趋势跟踪" },
    { value: "EMA", label: "EMA - 指数移动平均线", description: "趋势跟踪" },
    { value: "MACD", label: "MACD - 平滑异同移动平均线", description: "趋势动能" },
    { value: "BOLL", label: "BOLL - 布林线", description: "波动区间" },
  ],
  momentum: [
    { value: "RSI", label: "RSI - 相对强弱指数", description: "超买超卖" },
    { value: "KDJ", label: "KDJ - 随机指标", description: "短期反转" },
  ],
  volatility: [{ value: "ATR", label: "ATR - 真实波幅", description: "波动率" }],
  volume: [
    { value: "VOL", label: "VOL - 成交量", description: "量能" },
    { value: "VWAP", label: "VWAP - 量价加权均价", description: "量价结合" },
    { value: "OBV", label: "OBV - 能量潮", description: "量价结合" },
    { value: "MFI", label: "MFI - 资金流量指数", description: "量价结合" },
    { value: "VPT", label: "VPT - 量价趋势", description: "量价结合" },
  ],
}

export function IndicatorsDropdown({
  onAddIndicator,
  activeIndicators,
  onToggleIndicator,
  onRemoveIndicator,
}: IndicatorsDropdownProps) {
  const [selectedType, setSelectedType] = useState<IndicatorConfig["type"]>("MA")
  const [maPeriod, setMaPeriod] = useState("20")
  const [emaPeriod, setEmaPeriod] = useState("12")
  const [macdFast, setMacdFast] = useState("12")
  const [macdSlow, setMacdSlow] = useState("26")
  const [macdSignal, setMacdSignal] = useState("9")
  const [bollPeriod, setBollPeriod] = useState("20")
  const [bollStdDev, setBollStdDev] = useState("2")
  const [rsiPeriod, setRsiPeriod] = useState("14")
  const [kdjPeriod, setKdjPeriod] = useState("9")
  const [kdjK, setKdjK] = useState("3")
  const [kdjD, setKdjD] = useState("3")
  const [atrPeriod, setAtrPeriod] = useState("14")
  const [mfiPeriod, setMfiPeriod] = useState("14")

  const handleAddIndicator = () => {
    const config: IndicatorConfig = {
      type: selectedType,
      visible: true,
      params: {},
    }

    switch (selectedType) {
      case "MA":
        config.params = {
          period: Number.parseInt(maPeriod) || 20,
          color: "#2563eb",
        }
        break
      case "EMA":
        config.params = {
          period: Number.parseInt(emaPeriod) || 12,
          color: "#f59e0b",
        }
        break
      case "MACD":
        config.params = {
          fastPeriod: Number.parseInt(macdFast) || 12,
          slowPeriod: Number.parseInt(macdSlow) || 26,
          signalPeriod: Number.parseInt(macdSignal) || 9,
        }
        break
      case "BOLL":
        config.params = {
          period: Number.parseInt(bollPeriod) || 20,
          stdDev: Number.parseFloat(bollStdDev) || 2,
          color: "#8b5cf6",
        }
        break
      case "RSI":
        config.params = {
          period: Number.parseInt(rsiPeriod) || 14,
          color: "#ec4899",
        }
        break
      case "KDJ":
        config.params = {
          period: Number.parseInt(kdjPeriod) || 9,
          kPeriod: Number.parseInt(kdjK) || 3,
          dPeriod: Number.parseInt(kdjD) || 3,
        }
        break
      case "ATR":
        config.params = {
          period: Number.parseInt(atrPeriod) || 14,
          color: "#06b6d4",
        }
        break
      case "MFI":
        config.params = {
          period: Number.parseInt(mfiPeriod) || 14,
          color: "#84cc16",
        }
        break
      case "VOL":
      case "VWAP":
      case "OBV":
      case "VPT":
        // These indicators don't require parameters
        break
    }

    onAddIndicator(config)
  }

  const getIndicatorLabel = (config: IndicatorConfig): string => {
    switch (config.type) {
      case "MA":
        return `MA(${config.params.period})`
      case "EMA":
        return `EMA(${config.params.period})`
      case "MACD":
        return `MACD(${config.params.fastPeriod},${config.params.slowPeriod},${config.params.signalPeriod})`
      case "BOLL":
        return `BOLL(${config.params.period},${config.params.stdDev})`
      case "RSI":
        return `RSI(${config.params.period})`
      case "KDJ":
        return `KDJ(${config.params.period},${config.params.kPeriod},${config.params.dPeriod})`
      case "ATR":
        return `ATR(${config.params.period})`
      case "MFI":
        return `MFI(${config.params.period})`
      case "VOL":
        return "VOL"
      case "VWAP":
        return "VWAP"
      case "OBV":
        return "OBV"
      case "VPT":
        return "VPT"
      default:
        return config.type
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs mb-1.5 block">指标类型</Label>
          <Select value={selectedType} onValueChange={(value) => setSelectedType(value as IndicatorConfig["type"])}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">趋势类指标</div>
              {INDICATOR_CATEGORIES.trend.map((ind) => (
                <SelectItem key={ind.value} value={ind.value}>
                  <div className="flex flex-col">
                    <span>{ind.label}</span>
                    <span className="text-xs text-muted-foreground">{ind.description}</span>
                  </div>
                </SelectItem>
              ))}

              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-1">摆动/动能类</div>
              {INDICATOR_CATEGORIES.momentum.map((ind) => (
                <SelectItem key={ind.value} value={ind.value}>
                  <div className="flex flex-col">
                    <span>{ind.label}</span>
                    <span className="text-xs text-muted-foreground">{ind.description}</span>
                  </div>
                </SelectItem>
              ))}

              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-1">波动率类</div>
              {INDICATOR_CATEGORIES.volatility.map((ind) => (
                <SelectItem key={ind.value} value={ind.value}>
                  <div className="flex flex-col">
                    <span>{ind.label}</span>
                    <span className="text-xs text-muted-foreground">{ind.description}</span>
                  </div>
                </SelectItem>
              ))}

              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-1">成交量/量价结合</div>
              {INDICATOR_CATEGORIES.volume.map((ind) => (
                <SelectItem key={ind.value} value={ind.value}>
                  <div className="flex flex-col">
                    <span>{ind.label}</span>
                    <span className="text-xs text-muted-foreground">{ind.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* MA parameters */}
        {selectedType === "MA" && (
          <div className="flex-1 min-w-[100px]">
            <Label className="text-xs mb-1.5 block">周期</Label>
            <Input
              type="number"
              value={maPeriod}
              onChange={(e) => setMaPeriod(e.target.value)}
              className="h-9"
              placeholder="20"
              min="2"
            />
          </div>
        )}

        {/* EMA parameters */}
        {selectedType === "EMA" && (
          <div className="flex-1 min-w-[100px]">
            <Label className="text-xs mb-1.5 block">周期</Label>
            <Input
              type="number"
              value={emaPeriod}
              onChange={(e) => setEmaPeriod(e.target.value)}
              className="h-9"
              placeholder="12"
              min="2"
            />
          </div>
        )}

        {/* MACD parameters */}
        {selectedType === "MACD" && (
          <>
            <div className="flex-1 min-w-[80px]">
              <Label className="text-xs mb-1.5 block">快线</Label>
              <Input
                type="number"
                value={macdFast}
                onChange={(e) => setMacdFast(e.target.value)}
                className="h-9"
                placeholder="12"
                min="2"
              />
            </div>
            <div className="flex-1 min-w-[80px]">
              <Label className="text-xs mb-1.5 block">慢线</Label>
              <Input
                type="number"
                value={macdSlow}
                onChange={(e) => setMacdSlow(e.target.value)}
                className="h-9"
                placeholder="26"
                min="2"
              />
            </div>
            <div className="flex-1 min-w-[80px]">
              <Label className="text-xs mb-1.5 block">信号线</Label>
              <Input
                type="number"
                value={macdSignal}
                onChange={(e) => setMacdSignal(e.target.value)}
                className="h-9"
                placeholder="9"
                min="2"
              />
            </div>
          </>
        )}

        {/* BOLL parameters */}
        {selectedType === "BOLL" && (
          <>
            <div className="flex-1 min-w-[100px]">
              <Label className="text-xs mb-1.5 block">周期</Label>
              <Input
                type="number"
                value={bollPeriod}
                onChange={(e) => setBollPeriod(e.target.value)}
                className="h-9"
                placeholder="20"
                min="2"
              />
            </div>
            <div className="flex-1 min-w-[100px]">
              <Label className="text-xs mb-1.5 block">标准差倍数</Label>
              <Input
                type="number"
                value={bollStdDev}
                onChange={(e) => setBollStdDev(e.target.value)}
                className="h-9"
                placeholder="2"
                step="0.1"
                min="0.1"
              />
            </div>
          </>
        )}

        {/* RSI parameters */}
        {selectedType === "RSI" && (
          <div className="flex-1 min-w-[100px]">
            <Label className="text-xs mb-1.5 block">周期</Label>
            <Input
              type="number"
              value={rsiPeriod}
              onChange={(e) => setRsiPeriod(e.target.value)}
              className="h-9"
              placeholder="14"
              min="2"
            />
          </div>
        )}

        {/* KDJ parameters */}
        {selectedType === "KDJ" && (
          <>
            <div className="flex-1 min-w-[80px]">
              <Label className="text-xs mb-1.5 block">周期</Label>
              <Input
                type="number"
                value={kdjPeriod}
                onChange={(e) => setKdjPeriod(e.target.value)}
                className="h-9"
                placeholder="9"
                min="2"
              />
            </div>
            <div className="flex-1 min-w-[80px]">
              <Label className="text-xs mb-1.5 block">K平滑</Label>
              <Input
                type="number"
                value={kdjK}
                onChange={(e) => setKdjK(e.target.value)}
                className="h-9"
                placeholder="3"
                min="1"
              />
            </div>
            <div className="flex-1 min-w-[80px]">
              <Label className="text-xs mb-1.5 block">D平滑</Label>
              <Input
                type="number"
                value={kdjD}
                onChange={(e) => setKdjD(e.target.value)}
                className="h-9"
                placeholder="3"
                min="1"
              />
            </div>
          </>
        )}

        {/* ATR parameters */}
        {selectedType === "ATR" && (
          <div className="flex-1 min-w-[100px]">
            <Label className="text-xs mb-1.5 block">周期</Label>
            <Input
              type="number"
              value={atrPeriod}
              onChange={(e) => setAtrPeriod(e.target.value)}
              className="h-9"
              placeholder="14"
              min="2"
            />
          </div>
        )}

        {/* MFI parameters */}
        {selectedType === "MFI" && (
          <div className="flex-1 min-w-[100px]">
            <Label className="text-xs mb-1.5 block">周期</Label>
            <Input
              type="number"
              value={mfiPeriod}
              onChange={(e) => setMfiPeriod(e.target.value)}
              className="h-9"
              placeholder="14"
              min="2"
            />
          </div>
        )}

        {/* VOL, VWAP, OBV, VPT don't need parameters */}

        <Button onClick={handleAddIndicator} size="sm" className="h-9">
          添加指标
        </Button>
      </div>

      {activeIndicators.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeIndicators.map((indicator, index) => (
            <div
              key={index}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all cursor-pointer ${
                indicator.visible ? "bg-muted hover:bg-muted/80" : "bg-muted/50 opacity-60 hover:opacity-80"
              }`}
              onClick={() => onToggleIndicator(index)}
            >
              <span className="select-none">{getIndicatorLabel(indicator)}</span>
              <div className="flex items-center gap-1">
                {indicator.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 hover:bg-destructive/20"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveIndicator(index)
                  }}
                  title="删除指标"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
