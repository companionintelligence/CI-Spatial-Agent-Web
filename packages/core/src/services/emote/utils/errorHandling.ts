export type EmoteResult<T = void> = {
  success: boolean
  data?: T
  error?: string
}

export const createSuccess = <T>(data?: T): EmoteResult<T> => ({
  success: true,
  data
})

export const createError = (error: string): EmoteResult => ({
  success: false,
  error
})

export const safeExecute = <T>(operation: () => T, errorMessage: string): EmoteResult<T> => {
  try {
    const result = operation()
    return createSuccess(result)
  } catch (error) {
    console.warn(errorMessage, error)
    return { success: false, error: errorMessage } as EmoteResult<T>
  }
}
