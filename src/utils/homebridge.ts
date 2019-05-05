export interface Logger extends Function {
    readonly debug: Function;
    readonly info: Function;
    readonly warn: Function;
    readonly error: Function;
    readonly log: Function;
    readonly prefix: string;
}

export function callbackify(task: (...taskArgs: any[]) => Promise<any>): Function {
    return (...args: any[]) => {
        const onlyArgs: any[] = [];
        let callback: Function = undefined;

        for (const arg of args) {
            if (typeof arg === 'function') {
                callback = arg;
                break;
            }
            onlyArgs.push(arg);
        }
        if (!callback) {
            throw new Error("Missing callback parameter!");
        }
        task(...onlyArgs)
            .then((data: any) => callback(undefined, data))
            .catch((err: any) => callback(err))
    }
}