import { createServer } from './server'
console.log('starting...')

const port: number = parseInt(JSON.stringify(process.env.PORT), 10) || 3000

const start = async () => {
  const fastify = createServer({
    logger: true
  })

  try {
    await fastify.listen(port)
    fastify.log.info(`server started on port ${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
