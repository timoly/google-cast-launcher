import { CommonServiceParameters } from "../services";
import * as luxon from "luxon"
import * as m3u8 from "m3u8";
import * as request from "request";
import { flatMap } from "../flatMap";
import * as fs from "fs-extra";
import { transcode } from "../ffmpeg";
import { startCast, scanForAvailableDevices } from "../cast";
import * as path from "path";
import * as util from "util";
import { Logger } from "fastify";
const copyFile = util.promisify(fs.copyFile);
import * as xmlJs from "xml-js";
import {EpgChannel } from "../../../ios/src/shared"

export interface MosaicTVServiceParameters {
  channelName: string;
  type: "mosaicTV";
  hlsPath: string;
}

export const mosaicTvChannels = [
  "MTV3 HD",
  "MTV HD",
  "Liv HD",
  "FOX HD",
  "Alfa TV HD",
  "AVA HD",
  "Frii HD",
  "Hero HD",
  "Jim HD",
  "Kutonen HD",
  "Liv HD",
  "National Geographic HD",
  "Nelonen HD",
  "Sub HD",
  "TLC HD",
  "TV5 HD",
  "Yle Teema & Fem HD",
  "Yle TV1 HD",
  "Yle TV2 HD"
];

const channelApiUrl =
  "http://localhost:9270/mobile/?command=get_playlist_m3u&client=AAAA";

const epgApiUrl = "http://localhost:9270/mobile/?command=get_xmltv_epg&days=1";

interface Channel {
  title: string;
  url: string;
}

type KillFfmpeg = () => void;

let ffmpegProcess: null | KillFfmpeg = null;

interface M3u8PlaylistItem {
  properties: {
    title: string;
    uri: string;
  };
}

interface M3u8 {
  items: {
    PlaylistItem: M3u8PlaylistItem[];
  };
}

export const fetchChannels = async (): Promise<Channel[]> => {
  return new Promise((resolve, reject) => {
    const parser = m3u8.createStream();
    request(channelApiUrl)
      .on("error", (error: Error) => {
        reject(error);
      })
      .pipe(parser);

    parser.on("m3u", (m3u: M3u8) => {
      const channels = flatMap(m3u.items.PlaylistItem, item => {
        return mosaicTvChannels.includes(item.properties.title)
          ? [
              {
                title: item.properties.title,
                url: item.properties.uri
              }
            ]
          : [];
      });

      resolve(channels);
    });
  });
};

const copyLoadingIndicatorFiles = (log: Logger) => {
  log.info("copyLoadingIndicatorFiles");
  const getPath = (dir: string) => path.resolve(__dirname, "../../", dir);
  const filesToCopy = ["hls.m3u8", "hls0.ts", "hls1.ts", "hls2.ts"];
  return Promise.all([
    filesToCopy.map(file =>
      copyFile(getPath(`hls_loading/${file}`), getPath(`hls/${file}`))
    )
  ]);
};

export const start = async function({
  channelName,
  log,
  sinkName,
  hlsPath
}: CommonServiceParameters & MosaicTVServiceParameters) {
  const [devices, channels] = await Promise.all([
    scanForAvailableDevices(),
    fetchChannels()
  ]);

  const channel = channels.find(ch => ch.title === channelName);
  if (!channel) {
    throw new Error(`channel ${channelName} not found in mosaic playlist`);
  }

  const device = devices[sinkName];
  log.info("device", device);
  if (!device) {
    throw new Error(`sink ${sinkName} not found`);
  }

  if (ffmpegProcess) {
    ffmpegProcess();
    ffmpegProcess = null;
  }

  await copyLoadingIndicatorFiles(log);

  startCast({
    host: device.host,
    port: device.port,
    streamUrl: "http://192.168.1.249:3000/hls/hls.m3u8",
    log,
    streamTitle: channelName
  });

  ffmpegProcess = transcode({
    streamUrl: channel.url,
    log,
    hlsPath,
    onStart: () => {
      console.log("foo");
      // startCast({
      //   host: device.host,
      //   port: device.port,
      //   streamUrl: 'http://192.168.1.249:3000/hls/hls.m3u8',
      //   log,
      //   streamTitle: channelName
      // })
    }
  });
};

interface MosaicEpgChannel {
  _attributes: { id: string };
  "display-name": { _text: string };
}

interface MosaicEpgProgramme {
  _attributes: {
    channel: string;
    start: string;
    stop: string;
  };
  title: { _text: string };
  desc: {
    _text: string;
  };
}

interface MosaicEpg {
  tv: {
    channel: MosaicEpgChannel[];
    programme: MosaicEpgProgramme[];
  };
}

export const fetchEpg = () => {
  const formatDate = (value: string) => {
    // 20190729180000
    return luxon.DateTime.fromFormat(value, 'yyyyMMddHHmmss').toISOTime()
  };

  return new Promise<EpgChannel[]>((resolve, reject) => {
    request(epgApiUrl, (error, response, body) => {
      const epg = xmlJs.xml2js(body, {
        compact: true,
        ignoreDeclaration: true
      }) as MosaicEpg;

      console.log("??", epg.tv.programme[0]);
      const now = flatMap(mosaicTvChannels, channel => {
        const ch = epg.tv.channel.find(
          ch => ch["display-name"]._text === channel
        );
        if (!ch) {
          return []
        }
        const programme = epg.tv.programme.find(
          pg => pg._attributes.channel === ch._attributes.id
        );
        if (!programme) {
          return []
        }
        const response: EpgChannel = {
          channel,
          now: {
            name: programme.title._text,
            from: formatDate(programme._attributes.start),
            to: formatDate(programme._attributes.stop)
          }
        }
        return [response]
      });

      resolve(now);
    });
  });
};
