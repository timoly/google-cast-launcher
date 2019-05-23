import * as ruutu from './services/ruutu'
import * as youtube from './services/youtube'
import * as viaplay from './services/viaplay'
import { Page } from 'puppeteer'
import { LowdbSync } from 'lowdb'
import { Logger } from 'fastify'
import { Cast } from 'chrome-remote-interface'

export const services = {
  ruutu,
  viaplay,
  youtube
}
export type ServiceType = keyof typeof services

export interface CommonServiceParameters {
  page: Page
  Cast: Cast
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: LowdbSync<any>
  type: ServiceType
  sinkName: string
  log: Logger
}
