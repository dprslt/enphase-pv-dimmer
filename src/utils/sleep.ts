export function sleep(ms: number) {
    // add ms millisecond timeout before promise resolution
    return new Promise((resolve) => setTimeout(resolve, ms));
}
