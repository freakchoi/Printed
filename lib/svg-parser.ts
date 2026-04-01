export interface SVGField {
  id: string
  label: string
  defaultValue: string
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function parseSVGFields(svgString: string): SVGField[] {
  const textRegex = /<text[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g
  const matches = [...svgString.matchAll(textRegex)]
  return matches.map(([, id, innerContent]) => ({
    id,
    label: id.replace(/^text-/, ''),
    defaultValue: innerContent.replace(/<[^>]+>/g, '').trim(),
  }))
}

export function applyValuesToSVG(
  svgString: string,
  values: Record<string, string>
): string {
  let result = svgString
  for (const [id, value] of Object.entries(values)) {
    const escapedId = escapeRegex(id)
    // tspan이 있는 경우: 첫 번째 tspan 내부 텍스트 교체
    const tspanRegex = new RegExp(
      `(<text[^>]*id="${escapedId}"[^>]*>[\\s\\S]*?<tspan[^>]*>)[^<]*(</tspan>)`,
    )
    if (tspanRegex.test(result)) {
      result = result.replace(tspanRegex, (_, open, close) => `${open}${value}${close}`)
    } else {
      // tspan 없는 경우: text 직접 교체
      const textRegex = new RegExp(
        `(<text[^>]*id="${escapedId}"[^>]*>)[^<]*(</text>)`,
      )
      result = result.replace(textRegex, (_, open, close) => `${open}${value}${close}`)
    }
  }
  return result
}
