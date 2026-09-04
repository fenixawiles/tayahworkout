import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: /Preview Momentum/i }).click()
  await expect(page.getByRole('heading', { name: /Tayah/ })).toBeVisible()
})

test('keeps Today focused and free of horizontal overflow', async ({ page }) => {
  await expect(page.getByRole('progressbar')).toBeVisible()
  await expect(page.locator('.exercise-card').first()).toBeVisible()
  await expect(page.locator('.today-view .primary-button:visible')).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  const box = await nav.boundingBox()
  expect(box?.y).toBeLessThanOrEqual((await page.evaluate(() => window.innerHeight)) - 50)
})

test('unwinds picker, dirty editor, and selected day with Android Back', async ({ page }) => {
  await page.getByRole('button', { name: /Edit today’s workout/i }).click()
  await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByRole('dialog', { name: 'Add an exercise' })).toBeVisible()

  await page.goBack()
  await expect(page.getByRole('dialog', { name: 'Add an exercise' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible()

  const title = page.getByPlaceholder('Full body reset')
  await title.fill('A focused session')
  await expect(page.getByText('Unsaved changes')).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('alertdialog', { name: 'Discard your changes?' })).toBeVisible()
  await page.getByRole('button', { name: 'Keep editing' }).click()
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible()

  await page.goBack()
  await page.getByRole('button', { name: 'Discard' }).click()
  await expect(page.getByRole('heading', { name: /Tayah/ })).toBeVisible()
})

test('keeps calendar and library usable at Android viewports', async ({ page }) => {
  await page.getByRole('button', { name: 'Calendar' }).click()
  await expect(page.getByRole('heading', { name: /2026|2027|2028|2029|2030/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await page.getByRole('button', { name: 'Library' }).click()
  await expect(page.getByRole('heading', { name: 'Exercise library' })).toBeVisible()
  await expect(page.locator('.library-card')).toHaveCount(24)
  await page.getByPlaceholder('Search exercises').fill('plank')
  await expect(page.locator('.library-card')).toHaveCount(1)
  await page.getByPlaceholder('Search exercises').fill('upper body')
  await expect(page.locator('.library-card').first()).toBeVisible()
  expect(await page.locator('.library-card').count()).toBeGreaterThan(1)
  await expect(page.locator('.library-card .exercise-copy > span')).toHaveText([/Upper body/, /Upper body/, /Upper body/, /Upper body/, /Upper body/, /Upper body/])

  await page.getByRole('button', { name: 'Create custom exercise' }).click()
  await page.getByRole('button', { name: 'Category' }).click()
  await expect(page.getByRole('dialog', { name: 'Choose a category' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('dialog', { name: 'Choose a category' })).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Create an exercise' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
