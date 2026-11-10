// A desktop size screen by default. `setPhone()` makes it narrow for one test.
let phone = false;
export const setPhone = (value: boolean) => {
  phone = value;
};
window.matchMedia = (query: string) =>
  ({
    media: query,
    get matches() {
      return query.includes('min-width') && !phone;
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }) as unknown as MediaQueryList;
afterEach(() => {
  phone = false;
});
