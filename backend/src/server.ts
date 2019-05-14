import * as Fastify from 'fastify'
import * as CDP from 'chrome-remote-interface'
import * as puppeteer from 'puppeteer-core'

const env = (() => {
  const arg = process.argv[2]
  switch (arg) {
    case 'pi':
    case 'mac':
      return arg
    default:
      return 'mac'
  }
})()
import { config } from './config'
const envConfig = config[env]
const { targetSink, chromePath, userDataDir } = envConfig

import { ruutu } from './services/ruutu'
import { youtube } from './services/youtube'
import { viaplay, channelMapping } from './services/viaplay'

const services = {
  ruutu,
  viaplay,
  youtube
}
type Type = keyof typeof services

async function serviceHandler (
  page: puppeteer.Page,
  Cast: any,
  type: Type,
  serviceParameters: any
) {
  switch (type) {
    case 'ruutu':
      return services.ruutu(page, serviceParameters.url)
    case 'youtube':
      return services.youtube(page, serviceParameters.url)
    case 'viaplay':
      return services.viaplay({
        ...serviceParameters,
        page,
        Cast,
        sinkName: targetSink,
        username: config.viaplayUsername,
        password: config.viaplayPassword
      })
    default:
      throw new Error(`unsupported ${type}`)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cast (type: Type, serviceParameters: any) {
  try {
    const browser = await puppeteer.launch({
      headless: false,
      executablePath: chromePath,
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
        '--disk-cache-dir=./'
      ],
      userDataDir,
      ignoreDefaultArgs: true
    })
    const page = await browser.newPage()
    page.on('console', consoleObj => console.log(consoleObj.text()))
    const list = await CDP.List()
    const tab = list.find(i => i.url === 'about:blank' && i.type === 'page')
    if (!tab) {
      throw new Error('could not activate tab control')
    }

    const client = await CDP({ target: tab.id })
    await CDP.Activate({ id: tab.id })
    const { Cast } = client
    await Cast.enable()

    await new Promise(async (resolve, reject) => {
      let count = 0
      let castingStarted = false

      Cast.issueUpdated(msg => {
        console.log('cast issue:', msg)
      })

      Cast.sinksUpdated(async sinks => {
        if (castingStarted) {
          return
        }
        console.log('sinks:', sinks)
        const sinkName = sinks.sinkNames.find(sink => sink === targetSink)
        if (!sinkName && count > 5) {
          return reject(new Error('requested sink not found'))
        }
        if (sinkName) {
          castingStarted = true
          await Cast.setSinkToUse({ sinkName })
          try {
            await serviceHandler(page, Cast, type, serviceParameters)
          } catch (error) {
            reject(error)
          }
          resolve()
        }
      })
    })
    await Promise.all([client.close(), browser.close()])
  } catch (error) {
    console.error(error)
  }
}

export function createServer (opts?: Fastify.ServerOptions) {
  const fastify = Fastify(opts)

  fastify.get('/', async (_request, _reply) => {
    return {
      viaplay: {
        channels: channelMapping
      }
    }
  })

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  fastify.post('/', async (request, reply) => {
    console.log(request.query)
    // cast("ruutu", {url: "https://www.ruutu.fi/video/3257790"})
    // cast("youtube", {url: "https://www.youtube.com/watch?v=LOUgsAmD51s"})
    // 'CNN International'
    try {
      await cast(request.query.service, {
        channel: request.query.channel
      })
    } catch (error) {
      console.error(error)
      reply.status(500).send({ error })
    }
  })

  return fastify
}
