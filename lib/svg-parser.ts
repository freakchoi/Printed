export interface SVGField {
  id: string
  label: string
  defaultValue: string
}

export function parseSVGFields(svgString: string): SVGField[] {
  const matches = [...svgString.matchAll(/<text[^>]+id="([^"]+)"[^>]*>([^<]*)<\/text>/g)]
  return matches.map(([, id, defaultValue]) => ({
    id,
    label: id.replace(/^text-/, ''),
    defaultValue: defaultValue.trim(),
  }))
}

export function applyValuesToSVG(
  svgString: string,
  values: Record<string, string>
): string {
  let result = svgString
  for (const [id, value] of Object.entries(values)) {
    result = result.replace(
      new RegExp(`(<text[^>]+id="${id}"[^>]*>)[^<]*(</text>)`),
      `$1${value}$2`
    )
  }
  return result
}
