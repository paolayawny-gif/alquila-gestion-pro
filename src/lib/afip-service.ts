import forge from 'node-forge';

// ── URLs ──────────────────────────────────────────────────────────────────────

const WSAA_URL = {
  testing:    'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
  production: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
};
const WSFE_URL = {
  testing:    'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  production: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
};

// ── Certificate parsing ───────────────────────────────────────────────────────

export function parsePfx(pfxBase64: string, password: string): { certPem: string; keyPem: string } {
  const pfxDer  = forge.util.decode64(pfxBase64);
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const pfx     = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);

  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const keyBags  = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

  const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
  const key  = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;

  if (!cert || !key) throw new Error('No se pudo extraer el certificado o la clave del archivo .pfx');

  return {
    certPem: forge.pki.certificateToPem(cert),
    keyPem:  forge.pki.privateKeyToPem(key as forge.pki.rsa.PrivateKey),
  };
}

// ── WSAA ─────────────────────────────────────────────────────────────────────

function buildTRA(): string {
  const now     = new Date();
  const genTime = new Date(now.getTime() - 5  * 60 * 1000);
  const expTime = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(now.getTime() / 1000)}</uniqueId>
    <generationTime>${genTime.toISOString()}</generationTime>
    <expirationTime>${expTime.toISOString()}</expirationTime>
  </header>
  <service>wsfe</service>
</loginTicketRequest>`;
}

function signTRA(traXml: string, certPem: string, keyPem: string): string {
  const cert = forge.pki.certificateFromPem(certPem);
  const key  = forge.pki.privateKeyFromPem(keyPem);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(traXml, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType,  value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime,  value: new Date().toISOString() },
    ],
  });
  p7.sign();

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(der);
}

async function postSOAP(url: string, action: string, body: string): Promise<string> {
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction':   action,
    },
    body,
  });
  if (!res.ok) throw new Error(`SOAP ${res.status}: ${await res.text()}`);
  return res.text();
}

export async function getWSAAToken(
  certPem: string,
  keyPem:  string,
  environment: 'testing' | 'production',
): Promise<{ token: string; sign: string; expiresAt: string }> {
  const tra       = buildTRA();
  const signedTra = signTRA(tra, certPem, keyPem);

  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${signedTra}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  const text = await postSOAP(WSAA_URL[environment], '', soap);

  const tokenMatch = text.match(/<token>([^<]+)<\/token>/);
  const signMatch  = text.match(/<sign>([^<]+)<\/sign>/);
  const expMatch   = text.match(/<expirationTime>([^<]+)<\/expirationTime>/);

  if (!tokenMatch || !signMatch) throw new Error('Respuesta WSAA inválida');

  return {
    token:     tokenMatch[1],
    sign:      signMatch[1],
    expiresAt: expMatch?.[1] ?? new Date(Date.now() + 11 * 3600 * 1000).toISOString(),
  };
}

// ── WSFE ─────────────────────────────────────────────────────────────────────

export async function getLastVoucher(
  token: string, sign: string, cuit: string,
  puntoVenta: number, tipoComprobante: number,
  environment: 'testing' | 'production',
): Promise<number> {
  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECompUltimoAutorizado>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${cuit}</ar:Cuit>
      </ar:Auth>
      <ar:PtoVta>${puntoVenta}</ar:PtoVta>
      <ar:CbteTipo>${tipoComprobante}</ar:CbteTipo>
    </ar:FECompUltimoAutorizado>
  </soapenv:Body>
</soapenv:Envelope>`;

  const text = await postSOAP(
    WSFE_URL[environment],
    'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado',
    soap,
  );
  const m = text.match(/<CbteNro>(\d+)<\/CbteNro>/);
  return m ? parseInt(m[1]) : 0;
}

export interface EmitRequest {
  cuit:             string;
  puntoVenta:       number;
  tipoComprobante:  number;   // 6=FactB, 11=FactC
  concepto:         number;   // 2=Servicios
  docTipo:          number;   // 96=DNI, 80=CUIT, 99=CF
  docNro:           number;
  nroComprobante:   number;
  fecha:            string;   // YYYYMMDD
  importeTotal:     number;
  importeNoGravado: number;   // ImpTotConc (Fact B)
  importeNeto:      number;   // ImpNeto    (Fact C)
  importeIVA:       number;
  periodoDesde?:    string;   // YYYYMMDD
  periodoHasta?:    string;   // YYYYMMDD
}

export interface EmitResult {
  cae:             string;
  caeFechaVto:     string;   // YYYYMMDD
  nroComprobante:  number;
  resultado:       string;
}

export async function emitirFactura(
  token: string, sign: string,
  req:   EmitRequest,
  environment: 'testing' | 'production',
): Promise<EmitResult> {
  const ivaBlock = req.importeIVA > 0
    ? `<ar:Iva><ar:AlicIva><ar:Id>5</ar:Id><ar:BaseImp>${req.importeNeto.toFixed(2)}</ar:BaseImp><ar:Importe>${req.importeIVA.toFixed(2)}</ar:Importe></ar:AlicIva></ar:Iva>`
    : '';
  const periodoBlock = req.periodoDesde
    ? `<ar:FchServDesde>${req.periodoDesde}</ar:FchServDesde><ar:FchServHasta>${req.periodoHasta}</ar:FchServHasta><ar:FchVtoPago>${req.fecha}</ar:FchVtoPago>`
    : '';

  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECAESolicitar>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${req.cuit}</ar:Cuit>
      </ar:Auth>
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>${req.puntoVenta}</ar:PtoVta>
          <ar:CbteTipo>${req.tipoComprobante}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>${req.concepto}</ar:Concepto>
            <ar:DocTipo>${req.docTipo}</ar:DocTipo>
            <ar:DocNro>${req.docNro}</ar:DocNro>
            <ar:CbteDesde>${req.nroComprobante}</ar:CbteDesde>
            <ar:CbteHasta>${req.nroComprobante}</ar:CbteHasta>
            <ar:CbteFch>${req.fecha}</ar:CbteFch>
            <ar:ImpTotal>${req.importeTotal.toFixed(2)}</ar:ImpTotal>
            <ar:ImpTotConc>${req.importeNoGravado.toFixed(2)}</ar:ImpTotConc>
            <ar:ImpNeto>${req.importeNeto.toFixed(2)}</ar:ImpNeto>
            <ar:ImpOpEx>0.00</ar:ImpOpEx>
            <ar:ImpIVA>${req.importeIVA.toFixed(2)}</ar:ImpIVA>
            <ar:ImpTrib>0.00</ar:ImpTrib>
            ${periodoBlock}
            <ar:MonId>PES</ar:MonId>
            <ar:MonCotiz>1.00</ar:MonCotiz>
            ${ivaBlock}
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`;

  const text = await postSOAP(
    WSFE_URL[environment],
    'http://ar.gov.afip.dif.FEV1/FECAESolicitar',
    soap,
  );

  const caeMatch    = text.match(/<CAE>([^<]+)<\/CAE>/);
  const caeVtoMatch = text.match(/<CAEFchVto>([^<]+)<\/CAEFchVto>/);
  const nroMatch    = text.match(/<CbteDesde>(\d+)<\/CbteDesde>/);
  const resMatch    = text.match(/<Resultado>([^<]+)<\/Resultado>/);
  const errMatch    = text.match(/<Msg>([^<]+)<\/Msg>/);

  if (!caeMatch || resMatch?.[1] !== 'A') {
    throw new Error(`AFIP rechazó la factura: ${errMatch?.[1] ?? text.substring(0, 300)}`);
  }

  return {
    cae:            caeMatch[1],
    caeFechaVto:    caeVtoMatch?.[1] ?? '',
    nroComprobante: nroMatch ? parseInt(nroMatch[1]) : req.nroComprobante,
    resultado:      resMatch?.[1] ?? 'A',
  };
}
