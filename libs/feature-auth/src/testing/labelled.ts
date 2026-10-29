/** Matches a label's text with or without the " *" a required field adds to it. */
export const labelled = (text: string) =>
  new RegExp(String.raw`^${text}( \*)?$`);
