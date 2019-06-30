import * as cast from 'castv2-client'
import { Logger } from 'fastify'

const { Client, DefaultMediaReceiver } = cast

export const startCast = ({
  host,
  port,
  streamUrl,
  log
}: {
  host: string
  port: number
  streamUrl: string
  log: Logger
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
          title: 'Live TV'
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
