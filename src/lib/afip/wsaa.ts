import * as forge from 'node-forge'
import axios from 'axios'

const WSAA_HOMO = 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms'
const WSAA_PROD = 'https://wsaa.afip.gov.ar/ws/services/LoginCms'

export interface AfipTicket {
  token: string
  sign: string
  expiresAt: Date
}

// Cache de tickets en memoria { cuit_service: ticket }
const ticketCache = new Map<string, AfipTicket>()

function buildLoginTicketRequest(service: string): string {
  const now    = new Date()
  const expire = new Date(now.getTime() + 12 * 60 * 60 * 1000) // +12hs

  const fmt = (d: Date) => d.toISOString().slice(0, 19) + '-03:00'

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<loginTicketRequest version="1.0">',
    '  <header>',
    `    <uniqueId>${Math.floor(now.getTime() / 1000)}</uniqueId>`,
    `    <generationTime>${fmt(now)}</generationTime>`,
    `    <expirationTime>${fmt(expire)}</expirationTime>`,
    '  </header>',
    `  <service>${service}</service>`,
    '</loginTicketRequest>',
  ].join('\n')
}

function signCms(xml: string, certPem: string, keyPem: string): string {
  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(xml, 'utf8')

  const cert    = forge.pki.certificateFromPem(certPem)
  const privKey = forge.pki.privateKeyFromPem(keyPem)

  p7.addCertificate(cert)
  p7.addSigner({
    key: privKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [],
  })

  p7.sign({ detached: false })
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes()
  return forge.util.encode64(der)
}

export function p12ToPem(p12Base64: string, passphrase: string): { certPem: string; keyPem: string } {
  const p12Der  = forge.util.decode64(p12Base64)
  const p12Asn1 = forge.asn1.fromDer(p12Der)
  const p12     = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase)

  const keyBags  = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })

  const key  = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key
  const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert

  if (!key || !cert) throw new Error('Certificado inválido o contraseña incorrecta')

  return {
    certPem: forge.pki.certificateToPem(cert),
    keyPem:  forge.pki.privateKeyToPem(key),
  }
}

export async function getAfipTicket(
  cuit: string,
  certPem: string,
  keyPem: string,
  service = 'wsfe',
  sandbox = false
): Promise<AfipTicket> {
  const cacheKey = `${cuit}_${service}_${sandbox ? 'homo' : 'prod'}`
  const cached   = ticketCache.get(cacheKey)

  // Reusar ticket si vence en más de 10 minutos
  if (cached && cached.expiresAt.getTime() - Date.now() > 10 * 60 * 1000) {
    return cached
  }

  const xml    = buildLoginTicketRequest(service)
  const cms    = signCms(xml, certPem, keyPem)
  const wsaaUrl = sandbox ? WSAA_HOMO : WSAA_PROD

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ws="http://wsaa.view.sua.dvadac.desein.afip.gov.ar">
  <soapenv:Header/>
  <soapenv:Body>
    <ws:loginCms>
      <in0>${cms}</in0>
    </ws:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`

  const { data } = await axios.post(wsaaUrl, soapBody, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction':   '',
    },
    timeout: 15000,
  })

  // Extraer token y sign del XML de respuesta
  const tokenMatch = data.match(/<token>([\s\S]*?)<\/token>/)
  const signMatch  = data.match(/<sign>([\s\S]*?)<\/sign>/)
  const expMatch   = data.match(/<expirationTime>([\s\S]*?)<\/expirationTime>/)

  if (!tokenMatch || !signMatch) throw new Error('Respuesta inválida de WSAA')

  const ticket: AfipTicket = {
    token:     tokenMatch[1].trim(),
    sign:      signMatch[1].trim(),
    expiresAt: expMatch ? new Date(expMatch[1].trim()) : new Date(Date.now() + 11 * 60 * 60 * 1000),
  }

  ticketCache.set(cacheKey, ticket)
  return ticket
}
