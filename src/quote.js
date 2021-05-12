import { msg, deribit$ } from './deribit'
import { share, tap, filter, map } from 'rxjs/operators'

import { debugName } from './helpers'

const special = ['all', 'future', 'option']

function getChannels(instrument, currency) {
  const payload = {
    method: 'public/get_instruments',
    params: { currency, expired: false },
  }

  if (['option', 'future'].includes(instrument)) {
    payload.params.kind = instrument
  }

  return msg(payload).then(all => all.map(o => `ticker.${o.instrument_name}.100ms`))
}

export default function quote(instrument, curr = 'BTC') {
  let channels = []

  if (special.includes(instrument)) {
    getChannels(instrument, curr).then(chs => {
      channels = chs
      msg({ method: 'public/subscribe', params: { channels } })
    })

    setInterval(function () {
      getChannels(instrument, curr).then(chs => {
        channels = chs
        msg({ method: 'public/subscribe', params: { channels } })
      })
    }, 1000 * 60 * 15)
  } else {
    channels = [`ticker.${instrument}.100ms`]
    msg({ method: 'public/subscribe', params: { channels } })
  }

  return deribit$.pipe(
    filter(m => m.method === 'subscription' && channels.includes(m.params.channel)),
    map(o => ({
      instrument_name: o.params.data.instrument_name,
      bid: o.params.data.best_bid_price || null,
      ask: o.params.data.best_ask_price || null,
      bid_amount: o.params.data.best_bid_amount || null,
      ask_amount: o.params.data.best_ask_amount || null,
    })),
    tap(debugName('quote')),
    share()
  )
}
