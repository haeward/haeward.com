export async function bounded(promise, label, timeout = 15000) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error(`Timed out waiting for ${label}.`)),
                    timeout,
                );
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}
