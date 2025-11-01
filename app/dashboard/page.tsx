"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Thermometer, Droplets, Gauge, Wind, Zap, Sun, Volume2, AlertTriangle, RefreshCw } from "lucide-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

interface DeviceData {
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

interface Device {
  device_id: string
  device_name: string
  device_imei: string
  is_active: boolean
  user_id: string
  createdAt: string
  updatedAt: string
}

export default function DashboardPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>("")
  const [deviceData, setDeviceData] = useState<DeviceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState("")
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, boolean>>({})
  const router = useRouter()
  const searchParams = useSearchParams()

  // Auto-refresh effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (autoRefresh && selectedDevice) {
      interval = setInterval(() => {
        fetchDeviceData(selectedDevice, false) // Don't show loading on auto-refresh
        fetchDevices() // Also refresh device statuses
      }, 5000) // 5 seconds
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, selectedDevice])

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/auth/login")
      return
    }
    fetchDevices()
  }, [router])

  // Handle URL params for device selection
  useEffect(() => {
    const deviceParam = searchParams.get("device")
    if (deviceParam && devices.length > 0) {
      const deviceExists = devices.find((d) => d.device_id === deviceParam)
      if (deviceExists) {
        setSelectedDevice(deviceParam)
        fetchDeviceData(deviceParam)
      }
    }
  }, [searchParams, devices])

  const isDeviceOnline = (device: Device, latestData?: DeviceData) => {
    if (!latestData) return false
    const lastUpdate = Number.parseInt(latestData.recorded_at) * 1000
    const now = Date.now()
    return now - lastUpdate <= 20000 // 20 seconds threshold
  }

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

        // Update device statuses by checking latest data for each
        const statuses: Record<string, boolean> = {}
        for (const device of data) {
          try {
            const dataResponse = await fetch(`${API_BASE_URL}/data/latest/${device.device_id}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            })
            if (dataResponse.ok) {
              const deviceData = await dataResponse.json()
              statuses[device.device_id] = isDeviceOnline(device, deviceData)
            } else {
              statuses[device.device_id] = false
            }
          } catch {
            statuses[device.device_id] = false
          }
        }
        setDeviceStatuses(statuses)

        // Set default device if none selected and no URL param
        if (!selectedDevice && !searchParams.get("device") && data.length > 0) {
          setSelectedDevice(data[0].device_id)
          fetchDeviceData(data[0].device_id)
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

  const fetchDeviceData = async (deviceId: string, showLoading = true) => {
    if (!deviceId) return

    if (showLoading) setDataLoading(true)
    setError("") // Clear previous errors

    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${API_BASE_URL}/data/latest/${deviceId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setDeviceData(data)
        // Update device status
        const device = devices.find((d) => d.device_id === deviceId)
        if (device) {
          setDeviceStatuses((prev) => ({
            ...prev,
            [deviceId]: isDeviceOnline(device, data),
          }))
        }
      } else if (response.status === 404) {
        // Handle 404 specifically - no data available
        setDeviceData(null)
        setError("No data available for this device")
        setDeviceStatuses((prev) => ({
          ...prev,
          [deviceId]: false,
        }))
      } else {
        setDeviceData(null)
        setError("Failed to fetch device data")
      }
    } catch (err) {
      setDeviceData(null)
      setError("Network error")
    } finally {
      if (showLoading) setDataLoading(false)
    }
  }

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDevice(deviceId)
    setError("") // Clear any previous errors
    setDeviceData(null) // Clear previous data

    // Update URL without page refresh
    const url = new URL(window.location.href)
    url.searchParams.set("device", deviceId)
    window.history.replaceState({}, "", url.toString())

    fetchDeviceData(deviceId)
  }

  const refreshData = () => {
    if (selectedDevice) {
      fetchDeviceData(selectedDevice)
    }
    fetchDevices() // Also refresh device list and statuses
  }

  const getStatusColor = (value: number, type: string) => {
    switch (type) {
      case "temperature":
        if (value < 18 || value > 26) return "text-red-600"
        return "text-green-600"
      case "humidity":
        if (value < 30 || value > 70) return "text-yellow-600"
        return "text-green-600"
      case "co":
        if (value > 3) return "text-red-600"
        return "text-green-600"
      case "pm25":
        if (value > 300) return "text-red-600"
        if (value > 150) return "text-yellow-600"
        return "text-green-600"
      default:
        return "text-gray-600"
    }
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Real-time environmental monitoring</p>
          </div>
          <div className="flex items-center space-x-4">
            <Select value={selectedDevice} onValueChange={handleDeviceChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device) => (
                  <SelectItem key={device.device_id} value={device.device_id}>
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-2 h-2 rounded-full ${deviceStatuses[device.device_id] ? "bg-green-500" : "bg-red-500"}`}
                      ></div>
                      <span>{device.device_name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setAutoRefresh(!autoRefresh)} variant={autoRefresh ? "default" : "outline"}>
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
              {autoRefresh ? "Auto ON" : "Auto OFF"}
            </Button>
            <Button onClick={refreshData} disabled={dataLoading} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${dataLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {devices.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Zap className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Devices Found</h3>
              <p className="text-gray-600 text-center mb-4">
                You haven't added any devices yet. Add a device to start monitoring.
              </p>
              <Button onClick={() => router.push("/devices")}>Add Device</Button>
            </CardContent>
          </Card>
        ) : deviceData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Temperature</CardTitle>
                <Thermometer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getStatusColor(deviceData.temperature, "temperature")}`}>
                  {deviceData.temperature.toFixed(1)}°C
                </div>
                <p className="text-xs text-muted-foreground">Optimal: 18-26°C</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Humidity</CardTitle>
                <Droplets className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getStatusColor(deviceData.humidity, "humidity")}`}>
                  {deviceData.humidity.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Optimal: 30-70%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pressure</CardTitle>
                <Gauge className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{deviceData.pressure.toFixed(1)} hPa</div>
                <p className="text-xs text-muted-foreground">Atmospheric pressure</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Carbon Monoxide</CardTitle>
                <Wind className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getStatusColor(deviceData.co, "co")}`}>
                  {deviceData.co.toFixed(2)} ppm
                </div>
                <p className="text-xs text-muted-foreground">Safe: {"<"} 3 ppm</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Carbon Dioxide</CardTitle>
                <Wind className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getStatusColor(deviceData.co2, "co2")}`}>
                  {deviceData.co2.toFixed(2)} ppm
                </div>
                <p className="text-xs text-muted-foreground">Safe: {"<"} 800 ppm</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Methane</CardTitle>
                <Wind className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{deviceData.methane.toFixed(1)} ppm</div>
                <p className="text-xs text-muted-foreground">Gas concentration</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">LPG</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{deviceData.lpg.toFixed(1)} ppm</div>
                <p className="text-xs text-muted-foreground">Liquefied petroleum gas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">PM2.5</CardTitle>
                <Wind className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getStatusColor(deviceData.pm25, "pm25")}`}>
                  {deviceData.pm25.toFixed(1)} μg/m³
                </div>
                <p className="text-xs text-muted-foreground">Fine particles</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">PM10</CardTitle>
                <Wind className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600">{deviceData.pm10.toFixed(1)} μg/m³</div>
                <p className="text-xs text-muted-foreground">Coarse particles</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Noise Level</CardTitle>
                <Volume2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-600">{deviceData.noise.toFixed(1)} dB</div>
                <p className="text-xs text-muted-foreground">Sound level</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Light Level</CardTitle>
                <Sun className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{deviceData.light.toFixed(1)} lux</div>
                <p className="text-xs text-muted-foreground">Illuminance</p>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Device Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Device ID:</span>
                    <span className="text-sm font-mono">{deviceData.device_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Last Updated:</span>
                    <span className="text-sm">
                      {new Date(Number.parseInt(deviceData.recorded_at) * 1000).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge
                      variant="outline"
                      className={
                        deviceStatuses[selectedDevice]
                          ? "text-green-600 border-green-600"
                          : "text-red-600 border-red-600"
                      }
                    >
                      {deviceStatuses[selectedDevice] ? "Online" : "Offline"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          !dataLoading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
                <p className="text-gray-600 text-center">No recent data found for the selected device.</p>
              </CardContent>
            </Card>
          )
        )}

        {dataLoading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="h-12 w-12 text-gray-400 mb-4 animate-spin" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Data...</h3>
              <p className="text-gray-600 text-center">Fetching latest environmental readings.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
