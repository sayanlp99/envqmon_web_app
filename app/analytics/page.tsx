"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CalendarIcon,
  Download,
  RefreshCw,
  TrendingUp,
  Thermometer,
  Droplets,
  Gauge,
  Wind,
  Zap,
  Sun,
  Volume2,
} from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

interface Device {
  device_id: string
  device_name: string
  device_imei: string
  is_active: boolean
  user_id: string
  createdAt: string
  updatedAt: string
}

interface RangeData {
  id: string
  device_id: string
  temperature: number
  humidity: number
  pressure: number
  co: number
  co2: number
  methane: number
  lpg: number
  pm25: number
  pm10: number
  noise: number
  light: number
  recorded_at: string
}

export default function AnalyticsPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>("")
  const [rangeData, setRangeData] = useState<RangeData[]>([])
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState("")
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [autoRefresh, setAutoRefresh] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/auth/login")
      return
    }
    fetchDevices()

    // Set default date range (last 24 hours)
    const end = new Date()
    const start = new Date()
    start.setHours(start.getHours() - 24)
    setStartDate(start)
    setEndDate(end)
  }, [router])

  // Auto-refresh effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (autoRefresh && selectedDevice && startDate && endDate) {
      interval = setInterval(() => {
        fetchRangeData()
      }, 30000) // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, selectedDevice, startDate, endDate])

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${API_BASE_URL}/devices`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setDevices(data)
        if (data.length > 0) {
          setSelectedDevice(data[0].device_id)
        }
      } else {
        setError("Failed to fetch devices")
      }
    } catch (err) {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  const fetchRangeData = async () => {
    if (!selectedDevice || !startDate || !endDate) return

    setDataLoading(true)
    setError("")

    try {
      const token = localStorage.getItem("token")
      const startTimestamp = Math.floor(startDate.getTime() / 1000)
      const endTimestamp = Math.floor(endDate.getTime() / 1000)

      const response = await fetch(
        `${API_BASE_URL}/data/range?device_id=${selectedDevice}&from_ts=${startTimestamp}&to_ts=${endTimestamp}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (response.ok) {
        const data = await response.json()
        setRangeData(data)
      } else {
        setError("Failed to fetch range data")
      }
    } catch (err) {
      setError("Network error")
    } finally {
      setDataLoading(false)
    }
  }

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDevice(deviceId)
  }

  const handleFetchData = () => {
    fetchRangeData()
  }

  const setQuickRange = (hours: number) => {
    const end = new Date()
    const start = new Date()
    start.setHours(start.getHours() - hours)
    setStartDate(start)
    setEndDate(end)
  }

  const exportData = () => {
    if (rangeData.length === 0) return

    const csvContent = [
      "Timestamp,Temperature,Humidity,Pressure,CO,Methane,LPG,PM2.5,PM10,Noise,Light",
      ...rangeData.map(
        (row) =>
          `${new Date(Number.parseInt(row.recorded_at) * 1000).toISOString()},${row.temperature},${row.humidity},${row.pressure},${row.co},${row.methane},${row.lpg},${row.pm25},${row.pm10},${row.noise},${row.light}`,
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `environmental_data_${selectedDevice}_${format(startDate!, "yyyy-MM-dd")}_to_${format(endDate!, "yyyy-MM-dd")}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Prepare chart data with formatted timestamps
  const chartData = rangeData.map((item) => ({
    timestamp: new Date(Number.parseInt(item.recorded_at) * 1000).toLocaleTimeString(),
    fullTimestamp: new Date(Number.parseInt(item.recorded_at) * 1000).toLocaleString(),
    temperature: item.temperature,
    humidity: item.humidity,
    pressure: item.pressure,
    co: item.co,
    methane: item.methane,
    lpg: item.lpg,
    pm25: item.pm25,
    pm10: item.pm10,
    noise: item.noise,
    light: item.light,
  }))

  // Chart configurations for each metric
  const chartConfigs = [
    {
      title: "Temperature",
      icon: Thermometer,
      dataKey: "temperature",
      color: "#ef4444",
      unit: "°C",
      safeRange: { min: 18, max: 26 },
      description: "Ambient temperature monitoring",
    },
    {
      title: "Humidity",
      icon: Droplets,
      dataKey: "humidity",
      color: "#3b82f6",
      unit: "%",
      safeRange: { min: 30, max: 70 },
      description: "Relative humidity levels",
    },
    {
      title: "Atmospheric Pressure",
      icon: Gauge,
      dataKey: "pressure",
      color: "#8b5cf6",
      unit: "hPa",
      safeRange: null,
      description: "Barometric pressure readings",
    },
    {
      title: "Carbon Monoxide",
      icon: Wind,
      dataKey: "co",
      color: "#f59e0b",
      unit: "ppm",
      safeRange: { max: 3 },
      description: "CO concentration levels",
    },
    {
      title: "Carbon Dioxide",
      icon: Wind,
      dataKey: "co2",
      color: "#888f6dff",
      unit: "ppm",
      safeRange: { max: 3 },
      description: "CO2 concentration levels",
    },
    {
      title: "Methane",
      icon: Wind,
      dataKey: "methane",
      color: "#10b981",
      unit: "ppm",
      safeRange: null,
      description: "Methane gas concentration",
    },
    {
      title: "LPG",
      icon: Zap,
      dataKey: "lpg",
      color: "#f97316",
      unit: "ppm",
      safeRange: null,
      description: "Liquefied petroleum gas",
    },
    {
      title: "PM2.5",
      icon: Wind,
      dataKey: "pm25",
      color: "#ec4899",
      unit: "μg/m³",
      safeRange: { max: 150 },
      description: "Fine particulate matter",
    },
    {
      title: "PM10",
      icon: Wind,
      dataKey: "pm10",
      color: "#6366f1",
      unit: "μg/m³",
      safeRange: { max: 300 },
      description: "Coarse particulate matter",
    },
    {
      title: "Noise Level",
      icon: Volume2,
      dataKey: "noise",
      color: "#84cc16",
      unit: "dB",
      safeRange: null,
      description: "Sound level monitoring",
    },
    {
      title: "Light Level",
      icon: Sun,
      dataKey: "light",
      color: "#eab308",
      unit: "lux",
      safeRange: null,
      description: "Illuminance measurement",
    },
  ]

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="text-sm font-medium">{data.fullTimestamp}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}${entry.payload.unit || ""}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Environmental Dashboard</h1>
            <p className="text-gray-600">Real-time monitoring and historical analysis</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
              {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            </Button>
            <Button onClick={exportData} disabled={rangeData.length === 0} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Device</label>
                <Select value={selectedDevice} onValueChange={handleDeviceChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem key={device.device_id} value={device.device_id}>
                        {device.device_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "MMM dd, HH:mm") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "MMM dd, HH:mm") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Quick Range</label>
                <Select onValueChange={(value) => setQuickRange(Number(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Quick select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Last 1 hour</SelectItem>
                    <SelectItem value="6">Last 6 hours</SelectItem>
                    <SelectItem value="24">Last 24 hours</SelectItem>
                    <SelectItem value="168">Last 7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Data Points</label>
                <div className="text-sm bg-gray-100 px-3 py-2 rounded-md">{rangeData.length} records</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">&nbsp;</label>
                <Button
                  onClick={handleFetchData}
                  disabled={dataLoading || !selectedDevice || !startDate || !endDate}
                  className="w-full"
                >
                  {dataLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  {dataLoading ? "Loading..." : "Fetch Data"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Charts Grid */}
        {rangeData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {chartConfigs.map((config) => {
              const Icon = config.icon
              const values = rangeData.map((d) => d[config.dataKey as keyof RangeData] as number)
              const currentValue = values[values.length - 1]
              const avgValue = values.reduce((a, b) => a + b, 0) / values.length
              const minValue = Math.min(...values)
              const maxValue = Math.max(...values)

              return (
                <Card key={config.dataKey} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Icon className="h-5 w-5" style={{ color: config.color }} />
                        <CardTitle className="text-lg">{config.title}</CardTitle>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold" style={{ color: config.color }}>
                          {currentValue?.toFixed(1)} {config.unit}
                        </div>
                        <div className="text-xs text-muted-foreground">Current</div>
                      </div>
                    </div>
                    <CardDescription>{config.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 mb-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey="timestamp"
                            tick={{ fontSize: 10 }}
                            interval="preserveStartEnd"
                            stroke="#666"
                          />
                          <YAxis tick={{ fontSize: 10 }} stroke="#666" domain={["dataMin - 5", "dataMax + 5"]} />
                          <Tooltip content={<CustomTooltip />} />

                          {/* Safe range reference lines */}
                          {config.safeRange?.min && (
                            <ReferenceLine
                              y={config.safeRange.min}
                              stroke="#10b981"
                              strokeDasharray="5 5"
                              label={{ value: "Min Safe", position: "insideTopRight" }}
                            />
                          )}
                          {config.safeRange?.max && (
                            <ReferenceLine
                              y={config.safeRange.max}
                              stroke="#ef4444"
                              strokeDasharray="5 5"
                              label={{ value: "Max Safe", position: "insideTopRight" }}
                            />
                          )}

                          <Line
                            type="monotone"
                            dataKey={config.dataKey}
                            stroke={config.color}
                            strokeWidth={2}
                            dot={{ r: 1, fill: config.color }}
                            activeDot={{ r: 4, fill: config.color }}
                            name={config.title}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Statistics */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-medium text-green-600">{minValue.toFixed(1)}</div>
                        <div className="text-muted-foreground">Min</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-blue-600">{avgValue.toFixed(1)}</div>
                        <div className="text-muted-foreground">Avg</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-red-600">{maxValue.toFixed(1)}</div>
                        <div className="text-muted-foreground">Max</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          !dataLoading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
                <p className="text-gray-600 text-center">
                  Select a device and date range, then click "Fetch Data" to view the dashboard.
                </p>
              </CardContent>
            </Card>
          )
        )}

        {dataLoading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="h-12 w-12 text-gray-400 mb-4 animate-spin" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Environmental Data...</h3>
              <p className="text-gray-600 text-center">Fetching data from sensors for analysis.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
