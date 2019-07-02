import * as cast from 'castv2-client'
import { Logger } from 'fastify'
import * as mdns from 'mdns-js'

const { Client, DefaultMediaReceiver } = cast

const parseTxt = (items: string[]): { [index: string]: string } =>
  items.reduce((acc, cur) => {
    const split = cur.split('=')
    return { ...acc, [split[0]]: split[1] }
  }, {})

interface Device {
  name: string
  host: string
  port: number
}

interface Devices {
  [index: string]: Device
}
export const scanForAvailableDevices = (): Promise<Devices> => {
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

export const startCast = ({
  host,
  port,
  streamUrl,
  log,
  streamTitle
}: {
  host: string
  port: number
  streamUrl: string
  log: Logger
  streamTitle: string
}) => {
  const client = new Client()

  client.connect({ host, port }, () => {
    log.info('connected, launching app ...')

    client.launch(DefaultMediaReceiver, (err: Error, player: any) => {
      if (err) {
        throw err
      }

      const media = {
        contentId: streamUrl,
        contentType: 'application/x-mpegURL',
        streamType: 'LIVE',

        metadata: {
          title: `${streamTitle} (Live TV)`
        }
      }

      player.on('status', (status: string) => {
        log.info('status broadcast playerState', status)
      })

      log.info(
        'app "%s" launched, loading media %s ...',
        player.session.displayName,
        media.contentId
      )

      player.load(media, { autoplay: true }, (err: Error, status: string) => {
        if (err) {
          log.error(err)
          return
        }
        log.info('media loaded playerState', status)
      })
    })
  })

  client.on('error', (err: Error) => {
    log.info('Error: %s', err.message)
    client.close()
  })
}
