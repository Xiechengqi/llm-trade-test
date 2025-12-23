import type { KlineData } from "@/lib/types"

export interface MAResult {
  time: number
  value: number
}

export interface EMAResult {
  time: number
  value: number
}

export interface MACDResult {
  time: number
  macd: number
  signal: number
  histogram: number
}

export interface BOLLResult {
  time: number
  upper: number
  middle: number
  lower: number
}

export interface RSIResult {
  time: number
  value: number
}

export interface KDJResult {
  time: number
  k: number
  d: number
  j: number
}

export interface ATRResult {
  time: number
  value: number
}

export interface VWAPResult {
  time: number
  value: number
}

export interface OBVResult {
  time: number
  value: number
}

export interface MFIResult {
  time: number
  value: number
}

export interface VPTResult {
  time: number
  value: number
}

// Calculate Simple Moving Average (MA)
export function calculateMA(data: KlineData[], period: number): MAResult[] {
  if (data.length < period) return []

  const result: MAResult[] = []

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close
    }
    result.push({
      time: data[i].time,
      value: sum / period,
    })
  }

  return result
}

// Calculate Exponential Moving Average (EMA)
export function calculateEMA(data: KlineData[], period: number): EMAResult[] {
  if (data.length < period) return []

  const result: EMAResult[] = []
  const multiplier = 2 / (period + 1)

  // Calculate initial SMA as the first EMA value
  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += data[i].close
  }
  let ema = sum / period
  result.push({
    time: data[period - 1].time,
    value: ema,
  })

  // Calculate subsequent EMA values
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema
    result.push({
      time: data[i].time,
      value: ema,
    })
  }

  return result
}

// Calculate MACD (Moving Average Convergence Divergence)
export function calculateMACD(data: KlineData[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): MACDResult[] {
  if (data.length < slowPeriod) return []

  // Calculate fast and slow EMAs
  const fastEMA = calculateEMA(data, fastPeriod)
  const slowEMA = calculateEMA(data, slowPeriod)

  // Calculate MACD line (difference between fast and slow EMA)
  const macdLine: { time: number; value: number }[] = []
  const startIndex = slowPeriod - 1

  for (let i = 0; i < slowEMA.length; i++) {
    const fastIndex = i + (fastPeriod - 1)
    if (fastIndex < fastEMA.length) {
      macdLine.push({
        time: slowEMA[i].time,
        value: fastEMA[fastIndex].value - slowEMA[i].value,
      })
    }
  }

  // Calculate signal line (EMA of MACD line)
  if (macdLine.length < signalPeriod) return []

  const signalLine: { time: number; value: number }[] = []
  const signalMultiplier = 2 / (signalPeriod + 1)

  // Initial signal (SMA of first signalPeriod MACD values)
  let signalSum = 0
  for (let i = 0; i < signalPeriod; i++) {
    signalSum += macdLine[i].value
  }
  let signal = signalSum / signalPeriod
  signalLine.push({
    time: macdLine[signalPeriod - 1].time,
    value: signal,
  })

  // Calculate subsequent signal values
  for (let i = signalPeriod; i < macdLine.length; i++) {
    signal = (macdLine[i].value - signal) * signalMultiplier + signal
    signalLine.push({
      time: macdLine[i].time,
      value: signal,
    })
  }

  // Create final MACD result with histogram
  const result: MACDResult[] = []
  for (let i = 0; i < signalLine.length; i++) {
    const macdIndex = i + (signalPeriod - 1)
    result.push({
      time: signalLine[i].time,
      macd: macdLine[macdIndex].value,
      signal: signalLine[i].value,
      histogram: macdLine[macdIndex].value - signalLine[i].value,
    })
  }

  return result
}

// Calculate Bollinger Bands (BOLL) indicator
export function calculateBOLL(data: KlineData[], period = 20, stdDev = 2): BOLLResult[] {
  if (data.length < period) return []

  const result: BOLLResult[] = []

  for (let i = period - 1; i < data.length; i++) {
    // Calculate middle band (SMA)
    let sum = 0
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close
    }
    const middle = sum / period

    // Calculate standard deviation
    let variance = 0
    for (let j = 0; j < period; j++) {
      variance += Math.pow(data[i - j].close - middle, 2)
    }
    const std = Math.sqrt(variance / period)

    result.push({
      time: data[i].time,
      upper: middle + stdDev * std,
      middle: middle,
      lower: middle - stdDev * std,
    })
  }

  return result
}

// Calculate Relative Strength Index (RSI) indicator
export function calculateRSI(data: KlineData[], period = 14): RSIResult[] {
  if (data.length < period + 1) return []

  const result: RSIResult[] = []
  let gains = 0
  let losses = 0

  // Calculate initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close
    if (change > 0) {
      gains += change
    } else {
      losses += Math.abs(change)
    }
  }

  let avgGain = gains / period
  let avgLoss = losses / period

  result.push({
    time: data[period].time,
    value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss),
  })

  // Calculate subsequent RSI values using smoothed averages
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    result.push({
      time: data[i].time,
      value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss),
    })
  }

  return result
}

// Calculate KDJ (Stochastic) indicator
export function calculateKDJ(data: KlineData[], period = 9, kPeriod = 3, dPeriod = 3): KDJResult[] {
  if (data.length < period) return []

  const result: KDJResult[] = []
  const rsvList: number[] = []

  // Calculate RSV (Raw Stochastic Value)
  for (let i = period - 1; i < data.length; i++) {
    let highest = data[i - period + 1].high
    let lowest = data[i - period + 1].low

    for (let j = 0; j < period; j++) {
      const idx = i - j
      if (data[idx].high > highest) highest = data[idx].high
      if (data[idx].low < lowest) lowest = data[idx].low
    }

    const rsv = highest === lowest ? 50 : ((data[i].close - lowest) / (highest - lowest)) * 100
    rsvList.push(rsv)
  }

  // Calculate K, D, J values
  let k = 50
  let d = 50

  for (let i = 0; i < rsvList.length; i++) {
    k = (k * (kPeriod - 1) + rsvList[i]) / kPeriod
    d = (d * (dPeriod - 1) + k) / dPeriod
    const j = 3 * k - 2 * d

    result.push({
      time: data[period - 1 + i].time,
      k: k,
      d: d,
      j: j,
    })
  }

  return result
}

// Calculate Average True Range (ATR) indicator
export function calculateATR(data: KlineData[], period = 14): ATRResult[] {
  if (data.length < period + 1) return []

  const result: ATRResult[] = []
  const trueRanges: number[] = []

  // Calculate True Range for each period
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high
    const low = data[i].low
    const prevClose = data[i - 1].close

    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    trueRanges.push(tr)
  }

  // Calculate initial ATR (simple average of first period TRs)
  let atr = 0
  for (let i = 0; i < period; i++) {
    atr += trueRanges[i]
  }
  atr = atr / period

  result.push({
    time: data[period].time,
    value: atr,
  })

  // Calculate subsequent ATR values using smoothed average
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period
    result.push({
      time: data[i + 1].time,
      value: atr,
    })
  }

  return result
}

// Calculate Volume Weighted Average Price (VWAP) indicator
export function calculateVWAP(data: KlineData[]): VWAPResult[] {
  if (data.length === 0) return []

  const result: VWAPResult[] = []
  let cumulativeTPV = 0 // Typical Price * Volume
  let cumulativeVolume = 0

  for (let i = 0; i < data.length; i++) {
    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3
    cumulativeTPV += typicalPrice * data[i].volume
    cumulativeVolume += data[i].volume

    result.push({
      time: data[i].time,
      value: cumulativeVolume === 0 ? typicalPrice : cumulativeTPV / cumulativeVolume,
    })
  }

  return result
}

// Calculate On-Balance Volume (OBV) indicator
export function calculateOBV(data: KlineData[]): OBVResult[] {
  if (data.length === 0) return []

  const result: OBVResult[] = []
  let obv = 0

  result.push({
    time: data[0].time,
    value: 0,
  })

  for (let i = 1; i < data.length; i++) {
    if (data[i].close > data[i - 1].close) {
      obv += data[i].volume
    } else if (data[i].close < data[i - 1].close) {
      obv -= data[i].volume
    }
    // If close === prevClose, OBV stays the same

    result.push({
      time: data[i].time,
      value: obv,
    })
  }

  return result
}

// Calculate Money Flow Index (MFI) indicator
export function calculateMFI(data: KlineData[], period = 14): MFIResult[] {
  if (data.length < period + 1) return []

  const result: MFIResult[] = []
  const moneyFlows: { positive: number; negative: number }[] = []

  // Calculate money flow for each period
  for (let i = 1; i < data.length; i++) {
    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3
    const prevTypicalPrice = (data[i - 1].high + data[i - 1].low + data[i - 1].close) / 3
    const rawMoneyFlow = typicalPrice * data[i].volume

    if (typicalPrice > prevTypicalPrice) {
      moneyFlows.push({ positive: rawMoneyFlow, negative: 0 })
    } else if (typicalPrice < prevTypicalPrice) {
      moneyFlows.push({ positive: 0, negative: rawMoneyFlow })
    } else {
      moneyFlows.push({ positive: 0, negative: 0 })
    }
  }

  // Calculate MFI
  for (let i = period - 1; i < moneyFlows.length; i++) {
    let positiveFlow = 0
    let negativeFlow = 0

    for (let j = 0; j < period; j++) {
      positiveFlow += moneyFlows[i - j].positive
      negativeFlow += moneyFlows[i - j].negative
    }

    const mfi = negativeFlow === 0 ? 100 : 100 - 100 / (1 + positiveFlow / negativeFlow)

    result.push({
      time: data[i + 1].time,
      value: mfi,
    })
  }

  return result
}

// Calculate Volume Price Trend (VPT) indicator
export function calculateVPT(data: KlineData[]): VPTResult[] {
  if (data.length < 2) return []

  const result: VPTResult[] = []
  let vpt = 0

  result.push({
    time: data[0].time,
    value: 0,
  })

  for (let i = 1; i < data.length; i++) {
    const priceChange = (data[i].close - data[i - 1].close) / data[i - 1].close
    vpt += priceChange * data[i].volume

    result.push({
      time: data[i].time,
      value: vpt,
    })
  }

  return result
}
