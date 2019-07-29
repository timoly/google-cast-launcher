import { CommonServiceParameters } from '../services'
import * as m3u8 from 'm3u8'
import * as request from 'request'
import { flatMap } from '../flatMap'
import * as fs from 'fs-extra'
import { transcode } from '../ffmpeg'
import { startCast, scanForAvailableDevices } from '../cast'
import * as path from "path"
import * as util from "util"
import { Logger } from 'fastify';
const copyFile = util.promisify(fs.copyFile)

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

type KillFfmpeg = () => void

let ffmpegProcess: null | KillFfmpeg = null

interface M3u8PlaylistItem {
  properties: {
    title: string
    uri: string
  }
}

interface M3u8 {
  items: {
    PlaylistItem: M3u8PlaylistItem[]
  }
}

export const fetchChannels = async (): Promise<Channel[]> => {
  return new Promise((resolve, reject) => {
    const parser = m3u8.createStream()
    request(channelApiUrl)
      .on('error', (error: Error) => {
        reject(error)
      })
      .pipe(parser)

    parser.on('m3u', (m3u: M3u8) => {
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

const copyLoadingIndicatorFiles = (log: Logger) => {
  log.info("copyLoadingIndicatorFiles")
  const getPath = (dir: string) => path.resolve(__dirname, '../../', dir)
  const filesToCopy = ['hls.m3u8', 'hls0.ts', 'hls1.ts', 'hls2.ts']
  return Promise.all([
    filesToCopy.map(file => copyFile(getPath(`hls_loading/${file}`), getPath(`hls/${file}`)))
  ])
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

  if(ffmpegProcess){
    ffmpegProcess()
    ffmpegProcess = null
  }

  await copyLoadingIndicatorFiles(log)

  startCast({
    host: device.host,
    port: device.port,
    streamUrl: 'http://192.168.1.249:3000/hls/hls.m3u8',
    log,
    streamTitle: channelName
  })

  ffmpegProcess = transcode({
    streamUrl: channel.url,
    log,
    hlsPath,
    onStart: () => {
      console.log('foo')
      // startCast({
      //   host: device.host,
      //   port: device.port,
      //   streamUrl: 'http://192.168.1.249:3000/hls/hls.m3u8',
      //   log,
      //   streamTitle: channelName
      // })
    }
  })
}
