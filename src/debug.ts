export const debug = (process.env.DEBUG ? console.debug.bind(console) : () => undefined) as (...args) => undefined;
