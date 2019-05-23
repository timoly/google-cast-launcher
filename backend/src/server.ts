import * as Fastify from 'fastify'
import * as CDP from 'chrome-remote-interface'
import * as puppeteer from 'puppeteer-core'
import { services, ServiceType, CommonServiceParameters } from './services'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({
  path: process.env.PI
    ? path.resolve(process.cwd(), '../../', '.env')
    : path.resolve(process.cwd(), '.env')
})

import * as low from 'lowdb'
import * as FileSync from 'lowdb/adapters/FileSync'
import { ViaplayChannel, ViaplayServiceParameters } from './services/viaplay'
import { RuutuServiceParameters } from './services/ruutu'
import { YoutubeServiceParameters } from './services/youtube'

const adapter = new FileSync('service_cookies.json')
const db = low(adapter)

const requiredEnvParameters = {
  TARGET_SINK: null,
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
  TARGET_SINK,
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

async function serviceHandler (
  commonServiceParameters: CommonServiceParameters,
  serviceParameters: ServiceParameters
) {
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
  serviceParameters: ServiceParameters,
  log: Fastify.Logger
) {
  let browser
  let client
  try {
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
        '--allow-running-insecure-content'
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

    CDP.Activate
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
        if (castingStarted) {
          return
        }
        log.info('sinks:', sinks)
        const sinkName = sinks.sinkNames.find(sink => sink === TARGET_SINK)
        if (!sinkName && count > 5) {
          return reject(new Error('requested sink not found'))
        }
        if (sinkName) {
          castingStarted = true
          await Cast.setSinkToUse({ sinkName })
          try {
            await serviceHandler(
              {
                page,
                Cast,
                sinkName: TARGET_SINK,
                db,
                log,
                type: serviceParameters.type
              },
              serviceParameters
            )
          } catch (error) {
            reject(error)
          }
          resolve()
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

  fastify.get('/', async (_request, _reply) => {
    return {
      viaplay: {
        channels: services.viaplay.channels
      }
    }
  })

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  fastify.post('/', async (request, reply) => {
    fastify.log.info(request.query)
    // cast("ruutu", {url: "https://www.ruutu.fi/video/3257790"})
    // cast("youtube", {url: "https://www.youtube.com/watch?v=LOUgsAmD51s"})
    // 'CNN International'
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

      await cast(serviceParameters, fastify.log)
      reply.status(200).send()
    } catch (error) {
      fastify.log.error(error, 'channel start error')
      reply.status(500).send({ error: error.message })
    }
  })

  return fastify
}
