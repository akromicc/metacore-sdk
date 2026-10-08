// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { enhancePlainNotificationText, sanitizeNotificationHtml } from './rich-text'

describe('enhancePlainNotificationText', () => {
  it('keeps a formatted amount intact (PIT-023)', () => {
    expect(enhancePlainNotificationText('MX$1,060.00')).toBe('MX$<strong>1,060.00</strong>')
    expect(enhancePlainNotificationText('Total $12,345.60 cobrado')).toBe('Total $<strong>12,345.60</strong> cobrado')
    expect(enhancePlainNotificationText('1.060,00 €')).toBe('<strong>1.060,00</strong> €')
  })

  it('does not guess on a three-digit group', () => {
    expect(enhancePlainNotificationText('Saldo 1,060')).toBe('Saldo <strong>1,060</strong>')
  })

  it('still trims ledger quantities', () => {
    expect(enhancePlainNotificationText('Salida -1.0000 pz')).toBe('Salida <strong>-1 pz</strong>')
    expect(enhancePlainNotificationText('Quedan 1,50 kg')).toBe('Quedan <strong>1,5 kg</strong>')
    expect(enhancePlainNotificationText('Folio SO-00044')).toBe('Folio <strong>SO-00044</strong>')
  })
})

describe('sanitizeNotificationHtml with hostile input', () => {
  const dom = (html: string) => {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
    return doc.body
  }
  const assertInert = (out: string) => {
    const body = dom(out)
    // Only the allowlisted tags may survive, never with attributes.
    const allowed = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'MARK', 'CODE', 'BR', 'SPAN'])
    for (const el of Array.from(body.querySelectorAll('*'))) {
      expect(allowed.has(el.tagName), `tag ${el.tagName} in ${out}`).toBe(true)
      expect(el.attributes.length, `attrs on ${el.tagName} in ${out}`).toBe(0)
    }
    expect(out.toLowerCase()).not.toMatch(/javascript:/)
  }

  const cases: Record<string, string> = {
    'img onerror': '<img src=x onerror=alert(1)>hola',
    'img onerror quoted': '<img src="x" onerror="alert(1)">hola',
    'javascript href': '<a href="javascript:alert(1)">x</a>',
    'javascript href spaced': '<a href=" JaVaScRiPt:alert(1)">x</a>',
    'on* attribute on allowed tag': '<b onclick="alert(1)" onmouseover=alert(2)>x</b>',
    'svg onload': '<svg onload=alert(1)><circle/></svg>',
    'nested malformed script': '<scr<script>ipt>alert(1)</scr</script>ipt>',
    'unclosed tag': '<b <img src=x onerror=alert(1)>',
    'tag split by slash': '<b/onclick=alert(1)>x</b>',
    'style tag': '<style>*{x:expression(alert(1))}</style>',
    'iframe srcdoc': '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    'attribute with angle bracket': '<b title=">" onclick=alert(1)>x</b>',
  }

  for (const [name, input] of Object.entries(cases)) {
    it(`neutralizes: ${name}`, () => {
      assertInert(sanitizeNotificationHtml(input))
    })
  }

  it('keeps benign formatting', () => {
    expect(sanitizeNotificationHtml('<b>a</b> <i>b</i><br>')).toBe('<b>a</b> <i>b</i><br/>')
  })
})
