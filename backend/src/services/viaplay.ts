import { CommonServiceParameters } from '../services'

const channelMapping = {
  'YLE 1': {},
  'YLE 2': {},
  'Yle Teema/Fem': {},
  Fox: {},
  'National Geographic': {},
  'Nat Geo Wild': {},
  'Viasat Explorer': {},
  'Viasat Nature': {},
  'Viasat History': {},
  'BBC World News': {},
  'CNN International': {},
  Euronews: {},
  'Boomerang Nordic': {},
  'Nick Jr Scandinavia': {},
  'Cartoon Network': {},
  'Music Television HD': {},
  'MTV Hits': {},
  'VH1 Europe': {}
}

export type ViaplayChannel = keyof typeof channelMapping
export const channels = Object.keys(channelMapping) as ViaplayChannel[]
export interface ViaplayServiceParameters {
  type: 'viaplay'
  channel: ViaplayChannel
  username: string
  password: string
}

export const start = async function ({
  page,
  username,
  password,
  channel,
  db,
  Cast,
  sinkName,
  type,
  log
}: ViaplayServiceParameters & CommonServiceParameters) {
  const channelIndex = channels.findIndex(ch => ch === channel)
  if (channelIndex === -1) {
    throw new Error(`channel ${channel} is not supported`)
  }
  const initialCookies = await db.get(type).value()
  if (initialCookies) {
    await page.setCookie(...initialCookies)
  }
  // new Promise(resolve => setTimeout(resolve, 5000))
  await page.goto('https://viaplay.fi/kanavat')

  if (
    (await page.$('div[data-testhook="content-transition-spinner"')) !== null
  ) {
    log.info('clearing cookies and reloading...')
    await page.deleteCookie(...initialCookies)
    db.set(type, null).write()
    await page.reload()
  }

  if (
    (await page.$('button[data-testhook="header-authenticated-username"')) ===
    null
  ) {
    log.info('logging in to viaplay')
    const loginBtn = '.Navigation-right-1Ki5u'
    await page.waitForSelector(loginBtn, { visible: true, timeout: 5000 })
    await page.click(loginBtn)

    const usernameEl = 'input[data-testhook="login-username"]'
    await page.waitForSelector(`${usernameEl}:not([disabled])`, {
      visible: true,
      timeout: 5000
    })
    await page.type(usernameEl, username)
    await page.type('input[name="password"]', password)
    await page.click('input[type="submit"]')
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 })
  }

  const cookies = await page.cookies()
  db.set(type, cookies).write()

  const carouselEl = '.Carousel-inner-gyO8I'
  await page.waitForSelector(carouselEl, { visible: true })

  log.info('loading viaplay channel list')
  await page.evaluate(
    ({ el, channelCount }) => {
      return new Promise((resolve, reject) => {
        const intervalId = setInterval(() => {
          window.scrollBy(0, window.innerHeight)
          const channels = document.querySelectorAll(el).length

          if (channels === channelCount) {
            clearInterval(intervalId)
            resolve()
          }
        }, 500)

        setTimeout(async () => {
          clearInterval(intervalId)
          reject(new Error('unable to load full channel list'))
        }, 5000)
      })
    },
    { el: carouselEl, channelCount: channels.length }
  )

  log.info(`play channel ${channel}`)
  await page.evaluate(
    ({ el, channelIndex }) => {
      const $channelElement = Array.from(document.querySelectorAll(el))[
        channelIndex
      ]
      const $playButton = $channelElement.querySelector(
        'div[data-testhook="play-button"]'
      )
      $playButton.click()
    },
    { el: carouselEl, channelIndex }
  )

  log.info(`activating chromecast`)
  await Cast.startTabMirroring({ sinkName })
  await page.waitForSelector('video', { visible: true })
  await page.waitForSelector('.chromecast-connected', { visible: true })
  return new Promise(resolve => setTimeout(resolve, 5000))

  // await new Promise(async (resolve, reject) => {
  //   let counter = 0
  //   const click = async () => {
  //     try {
  //       await page.mouse.click(0, 0)
  //       const $chromecastButton = '.chromecast-inactive'
  //       await page.waitForSelector($chromecastButton, {
  //         visible: true,
  //         timeout: 1000
  //       })
  //       await page.click($chromecastButton)
  //       console.log('button found')
  //       resolve()
  //     } catch (error) {
  //       ++counter
  //       console.log('retry time', counter)
  //       if (counter > 10) {
  //         return reject(new Error('unable to activate chromecast'))
  //       }
  //       click()
  //     }
  //   }
  //   click()
  // })

  // const chromeCastTextSelector = '.chromecast-text'
  // await page.evaluate(chromeCastTextSelector => {
  //   console.log("hmm", chromeCastTextSelector)
  //   return new Promise((resolve, reject) => {
  //     const intervalId = setInterval(() => {
  //       const chromeCastTextEl = document.querySelector(chromeCastTextSelector)
  //       if (
  //         chromeCastTextEl &&
  //         chromeCastTextEl.textContent &&
  //         chromeCastTextEl.textContent.includes('Connected')
  //       ) {
  //         clearInterval(intervalId)
  //         resolve()
  //       }
  //     }, 200)

  //     setTimeout(() => {
  //       clearInterval(intervalId)
  //       reject()
  //     }, 5000)
  //   })
  // }, chromeCastTextSelector)
}
