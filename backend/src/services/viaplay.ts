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
  Cast,
  username,
  password,
  sinkName,
  channel,
  db,
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
    await page.waitForSelector(loginBtn, { visible: true })
    await page.click(loginBtn)
    await new Promise(resolve => {
      setTimeout(resolve, 1000)
    })
    await page.screenshot({ path: './login.png' })
    const usernameEl = 'input[name="username"]'
    await page.waitForSelector(usernameEl, { visible: true })
    await page.type(usernameEl, username)
    await page.type('input[name="password"]', password)
    await page.click('input[type="submit"]')
    await page.waitForNavigation({ waitUntil: 'networkidle0' })
  }

  const cookies = await page.cookies()
  db.set(type, cookies).write()

  const carouselEl = '.Carousel-inner-gyO8I'
  await page.waitForSelector(carouselEl, { visible: true })

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

        setTimeout(() => {
          clearInterval(intervalId)
          page.screenshot({ path: './channels.png' })
          reject(new Error('unable to load full channel list'))
        }, 5000)
      })
    },
    { el: carouselEl, channelCount: channels.length }
  )

  await page.evaluate(
    ({ el, channelIndex }) => {
      Array.from(document.querySelectorAll(el))
        [channelIndex].querySelector('div[data-testhook="play-button"]')
        .click()
    },
    { el: carouselEl, channelIndex }
  )
  await new Promise(resolve => {
    setTimeout(resolve, 1000)
  })
  await page.screenshot({ path: './video.png' })
  await page.waitForSelector('video', { visible: true })

  await Cast.startTabMirroring({ sinkName })

  await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      const intervalId = setInterval(() => {
        const chromeCastTextEl = document.querySelector('.chromecast-text')
        if (
          chromeCastTextEl &&
          chromeCastTextEl.textContent &&
          chromeCastTextEl.textContent.includes('Connected')
        ) {
          clearInterval(intervalId)
          resolve()
        }
      }, 200)

      setTimeout(reject, 7500)
    })
  })

  return new Promise(resolve => setTimeout(resolve, 2000))
}
