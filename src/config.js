// Everything a shop owner might want to change lives here.

export const FLOWERS = [
  { id: 'sunflower', name: 'Sunflower', price: 4.0, swatch: '#f0b400' },
  { id: 'peony', name: 'Peony', price: 6.0, swatch: '#f0a3bd' },
  { id: 'rose', name: 'Rose', price: 3.5, swatch: '#b81c3c' },
  { id: 'lily', name: 'Lily', price: 5.0, swatch: '#f6dfe6' },
  { id: 'tulip', name: 'Tulip', price: 2.5, swatch: '#ee7a35' },
  { id: 'daisy', name: 'Daisy', price: 1.5, swatch: '#fbfbf4' },
  { id: 'lavender', name: 'Lavender', price: 2.0, swatch: '#8468cf' },
  { id: 'eucalyptus', name: 'Eucalyptus', price: 1.5, swatch: '#8fae9d' },
];

// paper = outside of the wrap, ribbon = the matching satin shade.
export const WRAPPERS = [
  { id: 'kraft', name: 'Kraft', paper: '#b48f66', ribbon: '#6e2f2a' },
  { id: 'ivory', name: 'Ivory', paper: '#e9e2cf', ribbon: '#bfa271' },
  { id: 'blush', name: 'Blush', paper: '#e6bcbb', ribbon: '#ad4f63' },
  { id: 'sage', name: 'Sage', paper: '#a5b59b', ribbon: '#4c6a52' },
  { id: 'lilac', name: 'Lilac', paper: '#c5b9de', ribbon: '#6f57a3' },
  { id: 'sky', name: 'Sky', paper: '#b0cbdd', ribbon: '#3c6a96' },
  { id: 'butter', name: 'Butter', paper: '#eedd9a', ribbon: '#c2922a' },
  { id: 'ink', name: 'Ink', paper: '#2b303b', ribbon: '#9aa3ba' },
];

export const LIMITS = {
  standardWrapMax: 15, // most stems the standard wrap holds
  maxStems: 40,
  messageMax: 48,
};

export const FEES = {
  wrap: 4.0, // wrapper and ribbon
  largeWrap: 6.0, // added once the bouquet is over standardWrapMax
};

export const DEFAULTS = {
  wrapper: 'kraft',
  message: 'For you',
  stems: { rose: 3, peony: 2, daisy: 2, lavender: 1, eucalyptus: 2 },
};

// Free extras the florist adds. Not counted as stems and not priced.
export const FILLERS = {
  babysBreath: true, // small white sprigs tucked into the gaps between heads
};

// Sending a bouquet. The page posts to this address, where a small server
// function (in the portfolio site) emails the link from an address on the
// domain, with replies going to the sender. If the function is not there or
// not set up, "Send bouquet" opens the sender's own email app instead.
export const EMAIL = {
  endpoint: '/api/send-bouquet',
  subject: 'A bouquet for you',
  textMax: 240,
};
