import * as oauth2 from 'oauth4webapi'
import type {ENV_TYPE} from '../commons/enums'
import {PAGES_PATH} from '../commons/paths'

const ENV = import.meta.env as ENV_TYPE

Bun.serve({
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/') {
      const dexcomUrl = `https://${
        ENV.PROD == 'false' ? 'sandbox-' : ''
      }api.dexcom.com/v2/oauth2/login?client_id=${
        ENV.DEXCOM_AUTH
      }&redirect_uri=${ENV.URL}/dexcom&response_type=code&scope=offline_access`

      const stravaUrl = `http://www.strava.com/oauth/authorize?client_id=${ENV.STRAVA_AUTH}&response_type=code&redirect_uri=${ENV.URL}/strava&approval_prompt=force&scope=activity:read`

      return await serveHtml('index.html', {dexcomUrl, stravaUrl})
    }
    if (url.pathname === '/dexcom') {
      const search = new URLSearchParams(url.search)
      const error = search.get('error')
      if (!!error) {
        return new Response('ERROR :(\n' + error)
      }
      const code = search.get('code')
      const authTokens = JSON.parse(await authDexcom(code!))
      return await serveHtml('dexcom.html', {
        dexcomAuth: JSON.stringify(authTokens['access_token']!),
      })
    }
    if (url.pathname === '/strava') {
      const search = new URLSearchParams(url.search)
      const error = search.get('error')
      if (!!error) {
        return new Response('ERROR :(\n' + error)
      }
      const code = search.get('code')
      const authTokens = JSON.parse(await authStrava(code!))
      return await serveHtml('strava.html', {
        stravaAuth: JSON.stringify(authTokens['access_token']!),
      })
    }
    if (url.pathname === '/glucose' && req.method === 'POST') {
      try {
        const data = await req.formData()
        const meh = await fetch(
          `https://sandbox-api.dexcom.com/v3/users/self/egvs?startDate=${data.get(
            'startDate'
          )}&endDate=${data.get('endDate')}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${data.get('dexcomAuth')}`,
            },
          }
        )
        const w = await meh.json()
        return new Response(JSON.stringify(w))
      } catch (error) {
        return new Response(JSON.stringify({error}))
      }
    }
    if (url.pathname === '/activity' && req.method === 'POST') {
      const data = await req.formData()
      return await serveHtml('activity.html', {
        stravaAuth: data.get('stravaAuth'),
        dexcomAuth: data.get('dexcomAuth'),
        activityId: data.get('activityId'),
        sandbox: ENV.PROD == 'false' ? 'sandbox-' : '',
      })
    }
    return new Response('404')
  },
})

async function authDexcom(code: string) {
  const formData = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: ENV.URL + '/dexcom',
    client_id: ENV.DEXCOM_AUTH,
    client_secret: ENV.DEXCOM_SECRET,
  }

  const resp = await fetch(
    `https://${
      ENV.PROD == 'false' ? 'sandbox-' : ''
    }api.dexcom.com/v2/oauth2/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(formData).toString(),
    }
  )

  return await resp.text()
}

async function authStrava(code: string) {
  const formData = {
    grant_type: 'authorization_code',
    code,
    client_id: ENV.STRAVA_AUTH,
    client_secret: ENV.STRAVA_SECRET,
  }

  const resp = await fetch(`https://www.strava.com/api/v3/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(formData).toString(),
  })

  return await resp.text()
}

async function serveHtml(name: string, data: object) {
  const htmlFile = await Bun.file(PAGES_PATH + '/' + name).text()
  let injectedFile = htmlFile
  Object.entries(data).forEach(([key, value]) => {
    injectedFile = injectedFile.replaceAll(new RegExp(`{${key}}`, 'g'), value)
  })
  return new Response(injectedFile, {
    headers: {'content-type': 'text/html'},
  })
}

