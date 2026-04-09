'use strict'

import { SparkWallet } from '#libs/spark-sdk'

import Bip44SparkSigner from './src/bip-44/spark-signer.js'

const seedPhrase = process.env.WDK_SPARK_SEED || 'joy follow indicate right today betray turtle fetch spoil museum much excess'
const network = process.env.WDK_SPARK_NETWORK || 'REGTEST'
const callTimeoutMs = Number(process.env.WDK_SPARK_CALL_TIMEOUT_MS || 3000)
const pollIntervalMs = Number(process.env.WDK_SPARK_POLL_INTERVAL_MS || 5000)

let wallet

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
  })
])

async function getOwnedBalance () {
  const {
    satsBalance: { owned }
  } = await withTimeout(wallet.getBalance(), callTimeoutMs)

  return owned
}

async function cleanupAndExit (code) {
  if (wallet) {
    try {
      await wallet.cleanupConnections()
    } catch (error) {
      console.error('cleanup fail', error?.message || String(error))
    }
  }

  process.exit(code)
}

async function main () {
  console.log('Seed phrase: [redacted]')

  const { wallet: initializedWallet } = await SparkWallet.initialize({
    signer: new Bip44SparkSigner(0),
    mnemonicOrSeed: seedPhrase,
    options: { network }
  })

  wallet = initializedWallet

  console.log(await wallet.getSparkAddress())

  let poll = 0
  while (true) {
    poll += 1
    console.log(`poll ${poll}`)

    try {
      const balance = await getOwnedBalance()
      console.log(`balance ${balance}`)
    } catch (error) {
      console.log(`bal fail ${error?.message || String(error)}`)
    }

    await delay(pollIntervalMs)
  }
}

process.on('SIGINT', () => {
  cleanupAndExit(0).catch((error) => {
    console.error(error)
    process.exit(1)
  })
})

process.on('SIGTERM', () => {
  cleanupAndExit(0).catch((error) => {
    console.error(error)
    process.exit(1)
  })
})

main().catch((error) => {
  console.error(error)
  cleanupAndExit(1).catch(() => process.exit(1))
})
