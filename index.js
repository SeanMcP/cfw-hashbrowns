addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * Respond to the request
 * @param {Request} request
 */
async function handleRequest(request) {
  // @see https://community.cloudflare.com/t/withelist-cors-domains-for-workers/99441/4
  const { host } = new URL(request.url)
  const approvedHosts = APPROVED_HOSTS.split(',')

  if (!approvedHosts.includes(host)) {
    // Unauthorized hosts are rejected
    return new Response('Be patient with everyone.', { status: 403 })
  }

  if (request.method === 'POST') {
    return await handlePost(request)
  } else if (request.method === 'GET') {
    return await handleGet(request)
  } else {
    return new Response('Method not supported', { status: 400 })
  }
}

/**
 * Respond to GET requests
 * @param {Request} request
 */
async function handleGet(request) {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')

  if (key) {
    // Key provided, check value
    const value = await HASH_BROWNS.get(key)
    if (value) {
      // Value in store, return value
      return send(200, { data: value })
    } else {
      // No value for key
      return send(404, { message: 'Value not found' })
    }
  } else {
    // No key provided
    return new Response('Keyless request', { status: 400 })
  }
}

/**
 * Respond to POST requests
 * @param {Request} request
 */
async function handlePost(request) {
  const body = await request.text()

  if (body) {
    // Body provided, store value
    const key = await hash(body)
    await HASH_BROWNS.put(key, body)
    return send(200, { key })
  } else {
    // No body provided
    return send(400, { message: 'Invalid request' })
  }
}

/**
 * Send a new Response object
 * @param {number} status
 * @param {Object} body
 */
function send(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Hashes a string, then scrubs and clips to generate key
 * @param {string} target
 * @see https://stackoverflow.com/a/50043097/8486161
 */
async function hash(target) {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(target),
  )
  const chars = Array.prototype.map
    .call(new Uint8Array(buffer), ch => String.fromCharCode(ch))
    .join('')
  return btoa(chars)
    .replace(/[\W_]+/g, '')
    .slice(-8)
}
