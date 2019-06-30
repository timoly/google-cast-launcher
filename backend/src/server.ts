import * as Fastify from 'fastify'
import * as CDP from 'chrome-remote-interface'
import * as puppeteer from 'puppeteer-core'
import { services, ServiceType, CommonServiceParameters } from './services'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as mdns from 'mdns-js'
import { startCast } from './cast'
import * as fastifyStatic from 'fastify-static'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import * as low from 'lowdb'
import * as FileSync from 'lowdb/adapters/FileSync'
import { ViaplayChannel, ViaplayServiceParameters } from './services/viaplay'
import { RuutuServiceParameters } from './services/ruutu'
import { YoutubeServiceParameters } from './services/youtube'
import { ServerResponse } from 'http'
import { transcode } from './ffmpeg'

const adapter = new FileSync('./service_cookies.json')
const db = low(adapter)

const requiredEnvParameters = {
  CHROME_PATH: null,
  USER_DATA_DIR: null,
  VIAPLAY_USERNAME: null,
  VIAPLAY_PASSWORD: null
}

type EnvParametersKey = keyof typeof requiredEnvParameters
type EnvParameters = { [key in EnvParametersKey]: string }

type ServiceParameters =
  | ViaplayServiceParameters
  | RuutuServiceParameters
  | YoutubeServiceParameters

const {
  CHROME_PATH,
  USER_DATA_DIR,
  VIAPLAY_USERNAME,
  VIAPLAY_PASSWORD
} = Object.keys(requiredEnvParameters).reduce(
  (acc: EnvParameters, key) => {
    const value = process.env[key]
    if (!value) {
      console.error(`missing required parameter ${key} is not defined`)
      process.exit(1)
    }
    return {
      ...acc,
      [key]: value
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requiredEnvParameters as any
)

const parseTxt = (items: string[]): { [index: string]: string } =>
  items.reduce((acc, cur) => {
    const split = cur.split('=')
    return { ...acc, [split[0]]: split[1] }
  }, {})

const scanForAvailableDevices = () => {
  let devices = {}
  return new Promise(resolve => {
    var browser = mdns.createBrowser(mdns.tcp('googlecast'))
    browser.on('ready', function onReady () {
      browser.discover()
    })
    browser.on('update', function onUpdate (data: any) {
      const txt = parseTxt(data.txt || [])
      devices = {
        ...devices,
        [txt.fn]: {
          name: txt.fn,
          host: data.addresses[0],
          port: data.port
        }
      }
    })

    setTimeout(() => resolve(devices), 2500)
  })
}

function serviceHandler (
  commonServiceParameters: CommonServiceParameters,
  serviceParameters: ServiceParameters
) {
  commonServiceParameters.log.info('serviceHandler', serviceParameters.type)
  switch (serviceParameters.type) {
    case 'ruutu':
      return services.ruutu.start({
        ...commonServiceParameters,
        ...serviceParameters
      })
    case 'youtube':
      return services.youtube.start({
        ...commonServiceParameters,
        ...serviceParameters
      })
    case 'viaplay':
      return services.viaplay.start({
        ...commonServiceParameters,
        ...serviceParameters
      })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cast (
  targetDevice: string,
  serviceParameters: ServiceParameters,
  log: Fastify.Logger
) {
  let browser
  let client
  try {
    log.info('launching puppeteer')
    browser = await puppeteer.launch({
      headless: false,
      executablePath: CHROME_PATH,
      defaultViewport: {
        width: 1280,
        height: 1024
      },
      ignoreHTTPSErrors: true,
      args: [
        '--remote-debugging-port=9222',
        '--no-first-run',
        '--mute-audio',
        '--flag-switches-begin',
        '--load-media-router-component-extension=1',
        '--flag-switches-end',
        '--disk-cache-dir=./',
        '--allow-running-insecure-content',
        '--no-sandbox',
        '--disable-dev-shm-usage'
      ],
      userDataDir: USER_DATA_DIR,
      ignoreDefaultArgs: true
    })
    const page = await browser.newPage()
    page.on('console', consoleObj => log.info(consoleObj.text()))
    const list = await CDP.List()
    const tab = list.find(i => i.url === 'about:blank' && i.type === 'page')
    if (!tab) {
      throw new Error('could not activate tab control')
    }
    client = await CDP({ target: tab.id })
    await CDP.Activate({ id: tab.id })
    const { Cast } = client
    await Cast.enable()

    await new Promise(async (resolve, reject) => {
      let count = 0
      let castingStarted = false

      Cast.issueUpdated(msg => {
        log.info('cast issue:', msg)
      })

      Cast.sinksUpdated(async sinks => {
        try {
          if (castingStarted) {
            return
          }
          ++count
          log.info('sinks:', sinks, count)
          const sinkName = sinks.sinkNames.find(sink => sink === targetDevice)
          if (!sinkName && count === 10) {
            return reject(new Error('requested sink not found'))
          }
          if (sinkName) {
            castingStarted = true
            await Cast.setSinkToUse({ sinkName })
            await serviceHandler(
              {
                page,
                Cast,
                sinkName: targetDevice,
                db,
                log,
                type: serviceParameters.type
              },
              serviceParameters
            ).catch(reject)
            resolve()
          }
        } catch (error) {
          await page.screenshot({
            path: `./error-${Date.now()}.png`
          })
          reject(error)
        }
      })
    })
  } catch (error) {
    throw error
  } finally {
    log.info('cast clean up')
    if (client) {
      await client.close()
    }
    if (browser) {
      await browser.close()
    }
  }
}

export function createServer (opts?: Fastify.ServerOptions) {
  const fastify = Fastify(opts)

  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../', 'hls'),
    prefix: '/hls/',
    setHeaders: (res: ServerResponse) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
    }
  })

  fastify.get('/', async (_request, reply) => {
    return reply.send({
      services: [{ type: 'viaplay', channels: services.viaplay.channels }],
      devices: await scanForAvailableDevices()
    })
  })

  fastify.post('/hls', async (_request, reply) => {
    const devices = await scanForAvailableDevices()
    const device = devices['Living Room TV']
    console.log('device', device)
    try {
      transcode({
        streamUrl:
          'http://localhost:9271/stream/direct?client=AAAA&channel=2:130000:0:17:3291',
        log: fastify.log,
        onStart: () => {
          startCast({
            host: device.host,
            port: device.port,
            streamUrl: 'http://192.168.1.249:3000/hls/hls.m3u8',
            log: fastify.log
          })
        }
      })
    } catch (error) {
      fastify.log.error(error, 'tv channel start error')
      reply.status(500).send({ error: error.message })
    }

    return reply.send()
  })

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  fastify.post('/', async (request, reply) => {
    fastify.log.info(request.query)
    try {
      const service = ((): ServiceType | null => {
        switch (request.query.service) {
          case 'ruutu':
          case 'youtube':
          case 'viaplay':
            return request.query.service
          default:
            return null
        }
      })()

      if (!service) {
        return reply
          .status(400)
          .send({ error: `unsupported service: ${request.query.service}` })
      }

      const serviceParameters = ((): ServiceParameters => {
        switch (service) {
          case 'viaplay':
            return ((): ViaplayServiceParameters => {
              const channel = services.viaplay.channels.some(
                channel => request.query.channel === channel
              )
              if (!channel) {
                throw new Error(`unsupported channel: ${request.query.channel}`)
              }
              return {
                channel: request.query.channel as ViaplayChannel,
                username: VIAPLAY_USERNAME,
                password: VIAPLAY_PASSWORD,
                type: 'viaplay'
              }
            })()

          case 'ruutu':
            return { type: service, url: request.query.url as string }
          case 'youtube':
            return { type: service, url: request.query.url as string }
        }
      })()

      const targetDevice = request.query.targetDevice as string
      if (!targetDevice) {
        return reply
          .status(400)
          .send({ error: 'missing targetDevice parameter' })
      }

      await cast(targetDevice, serviceParameters, fastify.log)
      reply.status(200).send()
    } catch (error) {
      fastify.log.error(error, 'channel start error')
      reply.status(500).send({ error: error.message })
    }
  })

  return fastify
}
