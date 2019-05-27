console.log('starting...')
import 'source-map-support/register'
import { createServer } from './server'
// import * as Xvfb from 'xvfb'

process.on('SIGINT', function () {
  process.exit()
})

const port: number = parseInt(JSON.stringify(process.env.PORT), 10) || 3000

const start = async () => {
  // var xvfb = new Xvfb()
  // xvfb.startSync()

  // code that uses the virtual frame buffer here

  const fastify = createServer({
    logger: {
      prettyPrint: true,
      timestamp: () => `,"time":${new Date()}`
    }
  })

  try {
    await fastify.listen(port, '0.0.0.0')
    fastify.log.info(`server started on port ${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  // xvfb.stopSync()
}

start()
