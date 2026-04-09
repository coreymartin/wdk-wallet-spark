'use strict'

const runtimeProcess = typeof process !== 'undefined'
  ? process
  : (await import('bare-process')).default

const seedPhrase = runtimeProcess.env.WDK_SPARK_SEED || 'vivid battle invest nice mail sea pill bone boat skill symptom album'
const network = runtimeProcess.env.WDK_SPARK_NETWORK || 'REGTEST'
const callTimeoutMs = Number(runtimeProcess.env.WDK_SPARK_CALL_TIMEOUT_MS || 3000)
const pollIntervalMs = Number(runtimeProcess.env.WDK_SPARK_POLL_INTERVAL_MS || 5000)

let account

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
  })
])

async function cleanupAndExit (code) {
  if (account) {
    try {
      await account.cleanupConnections()
    } catch (error) {
      console.error('cleanup fail', error?.message || String(error))
    }
  }

  runtimeProcess.exit(code)
}

async function main () {
  console.log('Seed phrase: [redacted]')

  const modulePath = typeof Bare !== 'undefined' ? './bare.js' : './index.js'
  const { default: WalletManagerSpark } = await import(modulePath)
  const wallet = new WalletManagerSpark(seedPhrase, { network })
  account = await wallet.getAccount(0)

  console.log(await account.getAddress())

  let poll = 0
  while (true) {
    poll += 1
    console.log(`poll ${poll}`)

    try {
      const balance = await withTimeout(account.getBalance(), callTimeoutMs)
      console.log(`balance ${balance}`)
    } catch (error) {
      console.log(`bal fail ${error?.message || String(error)}`)
    }

    await delay(pollIntervalMs)
  }
}

runtimeProcess.on('SIGINT', () => {
  cleanupAndExit(0).catch((error) => {
    console.error(error)
    runtimeProcess.exit(1)
  })
})

runtimeProcess.on('SIGTERM', () => {
  cleanupAndExit(0).catch((error) => {
    console.error(error)
    runtimeProcess.exit(1)
  })
})

main().catch((error) => {
  console.error(error)
  cleanupAndExit(1).catch(() => runtimeProcess.exit(1))
})
