import { CommonServiceParameters } from '../services'
import * as m3u8 from 'm3u8'
import * as request from 'request'
import { flatMap } from '../flatMap'
import { transcode } from '../ffmpeg'
import { startCast, scanForAvailableDevices } from '../cast'

export interface MosaicTVServiceParameters {
  channelName: string
  type: 'mosaicTV'
  hlsPath: string
}

export const mosaicTvChannels = [
  'MTV3 HD',
  'MTV HD',
  'Liv HD',
  'FOX HD',
  'Alfa TV HD',
  'AVA HD',
  'Frii HD',
  'Hero HD',
  'Jim HD',
  'Kutonen HD',
  'Liv HD',
  'National Geographic HD',
  'Nelonen HD',
  'Sub HD',
  'TLC HD',
  'TV5 HD',
  'Yle Teema & Fem HD',
  'Yle TV1 HD',
  'Yle TV2 HD'
]

const channelApiUrl =
  'http://localhost:9270/mobile/?command=get_playlist_m3u&client=AAAA'

interface Channel {
  title: string
  url: string
}

export const fetchChannels = async (): Promise<Channel[]> => {
  return new Promise((resolve, reject) => {
    const parser = m3u8.createStream()
    request(channelApiUrl)
      .on('error', (error: Error) => {
        reject(error)
      })
      .pipe(parser)

    parser.on('m3u', m3u => {
      const channels = flatMap(m3u.items.PlaylistItem, item => {
        return mosaicTvChannels.includes(item.properties.title)
          ? [
            {
              title: item.properties.title,
              url: item.properties.uri
            }
          ]
          : []
      })

      resolve(channels)
    })
  })
}

export const start = async function ({
  channelName,
  log,
  sinkName,
  hlsPath
}: CommonServiceParameters & MosaicTVServiceParameters) {
  const [devices, channels] = await Promise.all([
    scanForAvailableDevices(),
    fetchChannels()
  ])

  const channel = channels.find(ch => ch.title === channelName)
  if (!channel) {
    throw new Error(`channel ${channelName} not found in mosaic playlist`)
  }

  const device = devices[sinkName]
  log.info('device', device)
  if (!device) {
    throw new Error(`sink ${sinkName} not found`)
  }

  transcode({
    streamUrl: channel.url,
    log,
    hlsPath,
    onStart: () => {
      startCast({
        host: device.host,
        port: device.port,
        streamUrl: 'http://192.168.1.249:3000/hls/hls.m3u8',
        log,
        streamTitle: channelName
      })
    }
  })
}
