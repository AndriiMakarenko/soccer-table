export const editableInputAttributes = {
  spellcheck: false,
} as const

export const freeTextInputAttributes = {
  ...editableInputAttributes,
  autocorrect: 'off',
  autocapitalize: 'off',
} as const
