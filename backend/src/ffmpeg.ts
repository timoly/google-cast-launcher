import * as ffmpeg from 'fluent-ffmpeg'
import { Logger } from 'fastify'

export const transcode = ({
  streamUrl,
  log,
  onStart,
  hlsPath
}: {
  streamUrl: string
  log: Logger
  hlsPath: string
  onStart: () => void
}) => {
  let hasStarted = false
  const process = ffmpeg(streamUrl, { timeout: 432000 })
    .outputOptions([
      '-c:v libx264',
      '-c:a aac',
      '-strict -2',
      '-crf 20',
      '-movflags +faststart',
      '-preset veryfast',
      '-profile:v high',
      '-level:v 4.1',
      '-maxrate 5000k',
      '-bufsize 1835k',
      '-pix_fmt yuv420p',
      '-flags',
      '-global_header',
      // '-hls_time 10',
      // '-hls_list_size 6',
      // '-hls_wrap 10',
      '-sn'
    ])
    .on('start', start => {
      log.info('transcode start', start)
    })
    .on('codecData', data => {
      log.info('transcode codecData', data)
    })
    .on('progress', progress => {
      if (progress.frames % 100 === 0) {
        log.info('transcode progress', progress)
      }
      if (progress.frames > 250 && !hasStarted) {
        hasStarted = true
        onStart()
      }
    })
    .once('stderr', stderrLine => {
      log.info('transcode stderr', stderrLine)
    })
    .on('end', () => {
      log.error('stream ended')
    })
    .on('error', (error: Error) => {
      log.error('transcode error:', error.message)
    })
    .save(`${hlsPath}/hls.m3u8`)

  return () => {
    log.info('killing ffmpeg process')
    process.kill('SIGKILL')
  }
}
