import * as Fastify from 'fastify'
import * as CDP from 'chrome-remote-interface'
import * as puppeteer from 'puppeteer-core'
import { services, ServiceType } from './services'
import * as dotenv from 'dotenv'
dotenv.config()

import * as low from 'lowdb'
import * as FileSync from 'lowdb/adapters/FileSync'

const adapter = new FileSync('service_cookies.json')
const db = low(adapter)

const {
  TARGET_SINK,
  CHROME_PATH,
  USER_DATA_DIR,
  VIAPLAY_USERNAME,
  VIAPLAY_PASSWORD
} = process.env
if (
  !TARGET_SINK ||
  !CHROME_PATH ||
  !USER_DATA_DIR ||
  !VIAPLAY_USERNAME ||
  !VIAPLAY_PASSWORD
) {
  console.error('not all required parameters are defined')
  process.exit(1)
}

async function serviceHandler (
  page: puppeteer.Page,
  Cast: any,
  type: ServiceType,
  serviceParameters: any
) {
  switch (type) {
    case 'ruutu':
      return services.ruutu(page, serviceParameters.url)
    case 'youtube':
      return services.youtube(page, serviceParameters.url)
    case 'viaplay':
      return services.viaplay.start({
        ...serviceParameters,
        page,
        Cast,
        sinkName: TARGET_SINK,
        username: VIAPLAY_USERNAME,
        password: VIAPLAY_PASSWORD,
        db,
        type
      })
    default:
      throw new Error(`unsupported ${type}`)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cast (type: ServiceType, serviceParameters: any) {
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
        '--disk-cache-dir=./'
      ],
      userDataDir: USER_DATA_DIR,
      ignoreDefaultArgs: true
    })
    const page = await browser.newPage()

    page.on('console', consoleObj => console.log(consoleObj.text()))
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
        console.log('cast issue:', msg)
      })

      Cast.sinksUpdated(async sinks => {
        if (castingStarted) {
          return
        }
        console.log('sinks:', sinks)
        const sinkName = sinks.sinkNames.find(sink => sink === TARGET_SINK)
        if (!sinkName && count > 5) {
          return reject(new Error('requested sink not found'))
        }
        if (sinkName) {
          castingStarted = true
          await Cast.setSinkToUse({ sinkName })
          try {
            await serviceHandler(page, Cast, type, serviceParameters)
          } catch (error) {
            console.error('service handler error:', error)
            reject(error)
          }
          resolve()
        }
      })
    })
  } catch (error) {
    console.error('cast error: ', error)
    throw error
  } finally {
    console.log('cast clean up')
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
        channels: services.viaplay.channelMapping
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
      reply.status(200).send()
    } catch (error) {
      console.error('channel start error:', error)
      reply.status(500).send({ error })
    }
  })

  return fastify
}
