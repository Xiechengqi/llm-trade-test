export interface KlineData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface CandleScore {
  time: number // timestamp
  score: number // parsed score value
}
