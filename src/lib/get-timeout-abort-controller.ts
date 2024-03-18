function getTimeoutAbortController (timeout: number): AbortController {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeout)
  return controller
}

export { getTimeoutAbortController }
