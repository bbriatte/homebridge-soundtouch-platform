export function apiNotFoundWithName(name: string): Error {
    return new Error(`Can't find device using the name '${name}' on your network`)
}