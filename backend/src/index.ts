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
      timestamp: () => `,"time":${new Date()}`,
      serializers: {
        res(res) {
          // the default
          return {
            statusCode: res.statusCode
          }
        },
        req(req) {
          return {
            method: req.method,
            url: req.url,
            path: req.path,
            parameters: req.parameters,
            // Including the headers in the log could be in violation 
            // of privacy laws, e.g. GDPR. You should use the "redact" option to
            // remove sensitive fields. It could also leak authentication data in
            // the logs.
            headers: req.headers
          };
        }
    }
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
