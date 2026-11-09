/** Matches a label's text, with or without the " *" of a required field. */
export const labelled = (text: string) =>
  new RegExp(String.raw`^${text}( \*)?$`);
