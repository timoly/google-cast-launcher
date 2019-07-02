import {
  CommonServiceParameters,
  PuppeteerServiceParameters
} from '../services'

export interface RuutuServiceParameters {
  url: string
  type: 'ruutu'
}

export const start = async function ({
  page,
  url
}: PuppeteerServiceParameters &
  CommonServiceParameters &
  RuutuServiceParameters) {
  const castButton = '.r-chromecast-button'
  const pauseButton = '.r-pause-button'
  const bannerSelector = '#sccm-opt-out-c1'

  await page.goto(url)

  if ((await page.$(bannerSelector)) !== null) {
    await page.click(bannerSelector)
  }

  await page.waitForSelector(pauseButton, { visible: true })
  await page.click(pauseButton)
  await page.waitForSelector(castButton, { visible: true, timeout: 1000 })
  await page.click(castButton)
  await page.waitForSelector('.r-chromecast-overlay-info', { visible: true })
}
