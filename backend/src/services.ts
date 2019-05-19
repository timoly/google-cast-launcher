import { ruutu } from './services/ruutu'
import { youtube } from './services/youtube'
import * as viaplay from './services/viaplay'

export const services = {
  ruutu,
  viaplay,
  youtube
}
export type ServiceType = keyof typeof services
