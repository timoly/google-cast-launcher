import { Page } from 'puppeteer'

export const youtube = async function (page: Page, url: string) {
  const playButton = '.ytp-play-button'
  const castButton = 'button[aria-label="Play on TV"'
  await page.goto(url)
  await page.waitForSelector(playButton, { visible: true })
  await page.click(playButton)
  await page.waitForSelector(castButton, { visible: true, timeout: 1000 })
  await page.click(castButton)
  await page.waitForSelector('.ytp-remote-display-status-text', {
    visible: true
  })
  return new Promise(resolve => setTimeout(resolve, 2000))
}
