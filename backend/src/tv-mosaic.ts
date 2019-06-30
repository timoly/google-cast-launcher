import * as m3u8 from 'm3u8'
import * as request from 'request'
import { flatMap } from './flatMap'

const channelWhitelist = ['MTV3 HD', 'MTV HD', 'Liv HD']

const channelApiUrl =
  'http://localhost:9270/mobile/?command=get_playlist_m3u&client=AAAA'

export const fetchChannels = async () => {
  return new Promise((resolve, reject) => {
    const parser = m3u8.createStream()
    request(channelApiUrl).pipe(parser)

    parser.on('m3u', m3u => {
      const channels = flatMap(m3u.items.PlaylistItem, item => {
        return channelWhitelist.includes(item.properties.title)
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
