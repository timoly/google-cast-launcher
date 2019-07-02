import * as ruutu from './services/ruutu'
import * as youtube from './services/youtube'
import * as viaplay from './services/viaplay'
import * as mosaicTV from './services/mosaic-tv'
import { Page } from 'puppeteer'
import { LowdbSync } from 'lowdb'
import { Logger } from 'fastify'
import { Cast } from 'chrome-remote-interface'

export const services = {
  ruutu,
  viaplay,
  youtube,
  mosaicTV
}
export type ServiceType = keyof typeof services

export interface PuppeteerServiceParameters {
  page: Page
  Cast: Cast
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: LowdbSync<any>
}

export interface CommonServiceParameters {
  type: ServiceType
  sinkName: string
  log: Logger
}
