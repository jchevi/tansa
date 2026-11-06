export class RecordNotFoundError extends Error {
  constructor(store: string, id: string) {
    super(`No record in ${store} with id ${id}`)
    this.name = 'RecordNotFoundError'
  }
}

// Only one session may be in progress (running or paused) at a time [TAN-18].
export class SessionInProgressError extends Error {
  constructor(sessionId: string) {
    super(`Session ${sessionId} is already in progress`)
    this.name = 'SessionInProgressError'
  }
}

export class InvalidRecordError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidRecordError'
  }
}
