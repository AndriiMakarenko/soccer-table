import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const editableTags = /<(?:input|textarea|InputText|Textarea)\b[^>]*>/g

describe('editable control spellcheck regression guard', () => {
  /**
   * GIVEN every Vue component that declares a native or PrimeVue editable control
   * WHEN its template boundary is inspected
   * THEN every control explicitly binds the centralized disabled-spellcheck attributes
   */
  it('requires the shared editable attributes on every declared control', () => {
    const componentPaths = vueFiles(resolve('src'))
    let controlCount = 0

    for (const componentPath of componentPaths) {
      const source = readFileSync(resolve(componentPath), 'utf8')
      const controls = source.match(editableTags) ?? []
      controlCount += controls.length
      for (const control of controls) {
        expect(control, `${componentPath}: ${control}`).toMatch(
          /(?:spellcheck="false"|v-bind="(?:editableInputAttributes|freeTextInputAttributes)")/,
        )
      }
    }
    expect(controlCount).toBeGreaterThan(0)
  })
})

function vueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return vueFiles(path)
    return entry.name.endsWith('.vue') ? [path] : []
  })
}
