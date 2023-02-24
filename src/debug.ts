export const debug = (typeof process !== 'undefined' && process.env.DEBUG ? console.debug.bind(console) : () => undefined) as (...args) => undefined;
