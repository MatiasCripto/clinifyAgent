import axios from 'axios'
import type { AfipTicket } from './wsaa'

const WSFE_HOMO = 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx'
const WSFE_PROD = 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'

// Tipos de comprobante ARCA
export const INVOICE_TYPE_CODES: Record<string, number> = {
  'FC-A':  1,   // Factura A
  'FC-B':  6,   // Factura B
  'FC-C':  11,  // Factura C
  'NC-A':  3,   // Nota de Crédito A
  'NC-B':  8,   // Nota de Crédito B
  'ND':    2,   // Nota de Débito A (simplificado)
}

// Tipos de IVA
const IVA_CODES: Record<number, number> = {
  0:  3,  // 0%
  10.5: 4, // 10.5%
  21: 5,  // 21%
  27: 6,  // 27%
}

export interface WsfeInvoiceInput {
  cuit: string
  puntoVenta: number
  invoiceType: string   // 'FC-A' | 'FC-B' | 'FC-C' etc
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  invoiceDate: string   // YYYYMMDD
  currency: string      // 'PES' | 'DOL'
  concept: number       // 1=productos, 2=servicios, 3=ambos
}

export interface WsfeResult {
  cae: string
  caeExpiry: string     // YYYYMMDD
  invoiceNumber: number
}

function soapEnvelope(action: string, cuit: string, token: string, sign: string, body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soap:Header/>
  <soap:Body>
    <ar:${action}>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${cuit.replace(/-/g, '')}</ar:Cuit>
      </ar:Auth>
      ${body}
    </ar:${action}>
  </soap:Body>
</soap:Envelope>`
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  return m ? m[1].trim() : ''
}

export async function getLastInvoiceNumber(
  cuit: string,
  ticket: AfipTicket,
  puntoVenta: number,
  invoiceType: string,
  sandbox: boolean
): Promise<number> {
  const url     = sandbox ? WSFE_HOMO : WSFE_PROD
  const typeCode = INVOICE_TYPE_CODES[invoiceType] ?? 11

  const body = `
    <ar:PtoVta>${puntoVenta}</ar:PtoVta>
    <ar:CbteTipo>${typeCode}</ar:CbteTipo>`

  const soap = soapEnvelope('FECompUltimoAutorizado', cuit, ticket.token, ticket.sign, body)

  const { data } = await axios.post(url, soap, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado',
    },
    timeout: 15000,
  })

  const num = extractTag(data, 'CbteNro')
  return num ? parseInt(num) : 0
}

export async function requestCae(
  ticket: AfipTicket,
  input: WsfeInvoiceInput,
  sandbox: boolean
): Promise<WsfeResult> {
  const url      = sandbox ? WSFE_HOMO : WSFE_PROD
  const typeCode = INVOICE_TYPE_CODES[input.invoiceType] ?? 11
  const ivaCode  = IVA_CODES[input.taxRate] ?? 5
  const cuitNum  = input.cuit.replace(/-/g, '')
  const currCode = input.currency === 'USD' ? 'DOL' : 'PES'

  // Obtener último número de comprobante
  const lastNum     = await getLastInvoiceNumber(input.cuit, ticket, input.puntoVenta, input.invoiceType, sandbox)
  const invoiceNum  = lastNum + 1

  const body = `
    <ar:FeCAEReq>
      <ar:FeCabReq>
        <ar:CantReg>1</ar:CantReg>
        <ar:PtoVta>${input.puntoVenta}</ar:PtoVta>
        <ar:CbteTipo>${typeCode}</ar:CbteTipo>
      </ar:FeCabReq>
      <ar:FeDetReq>
        <ar:FECAEDetRequest>
          <ar:Concepto>${input.concept}</ar:Concepto>
          <ar:DocTipo>99</ar:DocTipo>
          <ar:DocNro>0</ar:DocNro>
          <ar:CbteDesde>${invoiceNum}</ar:CbteDesde>
          <ar:CbteHasta>${invoiceNum}</ar:CbteHasta>
          <ar:CbteFch>${input.invoiceDate}</ar:CbteFch>
          <ar:ImpTotal>${input.total.toFixed(2)}</ar:ImpTotal>
          <ar:ImpTotConc>0.00</ar:ImpTotConc>
          <ar:ImpNeto>${input.subtotal.toFixed(2)}</ar:ImpNeto>
          <ar:ImpOpEx>0.00</ar:ImpOpEx>
          <ar:ImpIVA>${input.taxAmount.toFixed(2)}</ar:ImpIVA>
          <ar:ImpTrib>0.00</ar:ImpTrib>
          <ar:MonId>${currCode}</ar:MonId>
          <ar:MonCotiz>1</ar:MonCotiz>
          <ar:Iva>
            <ar:AlicIva>
              <ar:Id>${ivaCode}</ar:Id>
              <ar:BaseImp>${input.subtotal.toFixed(2)}</ar:BaseImp>
              <ar:Importe>${input.taxAmount.toFixed(2)}</ar:Importe>
            </ar:AlicIva>
          </ar:Iva>
        </ar:FECAEDetRequest>
      </ar:FeDetReq>
    </ar:FeCAEReq>`

  const soap = soapEnvelope('FECAESolicitar', cuitNum, ticket.token, ticket.sign, body)

  const { data } = await axios.post(url, soap, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECAESolicitar',
    },
    timeout: 20000,
  })

  // Verificar errores
  const errMsg = extractTag(data, 'Msg')
  const result = extractTag(data, 'Resultado')
  if (result === 'R' || (errMsg && errMsg !== '')) {
    const obs = extractTag(data, 'Obs') || errMsg
    throw new Error(`ARCA rechazó la factura: ${obs}`)
  }

  const cae       = extractTag(data, 'CAE')
  const caeExpiry = extractTag(data, 'CAEFchVto')

  if (!cae) throw new Error('No se recibió CAE en la respuesta de ARCA')

  return { cae, caeExpiry, invoiceNumber: invoiceNum }
}
