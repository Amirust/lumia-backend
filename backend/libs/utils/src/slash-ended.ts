export const slashEnded = (str: string) => {
  return str.endsWith('/') ? str : `${str}/`
}
