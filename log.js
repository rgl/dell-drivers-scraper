export function log() {
    console.log.apply(console, [new Date().toISOString(), ...arguments]);
}
