export class RecordNotFoundError extends Error {
  constructor(store: string, id: string) {
    super(`No record in ${store} with id ${id}`)
    this.name = 'RecordNotFoundError'
  }
}

export class InvalidRecordError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidRecordError'
  }
}
