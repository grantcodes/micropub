
class MicropubError extends Error {
  status: number | null
  error: any

  constructor (message: string, status: number = 0, error: any = null) {
    super(message)
    this.name = 'MicropubError'

    if (error instanceof MicropubError) {
      this.status = error.status
      this.error = error.error
    } else {
      this.status = status === 0 ? null : status
      this.error = error
    }
  }
}

export { MicropubError }
