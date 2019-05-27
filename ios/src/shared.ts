export interface Service {
  type: string
  channels: string[]
}

export interface ApiResponse {
  services: Service[]
  devices: string[]
}