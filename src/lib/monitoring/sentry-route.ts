/**
 * Parametrization of routes and URLs for Sentry (clinical SaaS: a patient id or a verification code
 * in a URL must never leave the browser). Shared by the filter of error events (`sentry-options.ts`,
 * always in the bundle of browser, server and edge) and by the Web Vitals transactions
 * (`sentry-tracing.ts`, only when tracing is on). Small and dependency-free on purpose.
 */

export const UNMATCHED = '<unmatched route>';

/** A word of a static route (`patients`, `como-funciona`). */
const STATIC_SEGMENT = /^[a-z][a-z-]*$/;
/** A parameter of the route manifest (`:id`, `:slug*`) or of a Next route (`[id]`, `[...slug]`). */
const PARAM_SEGMENT =
  /^(?::[A-Za-z_][A-Za-z0-9_]*[*?]*|\[{1,2}(?:\.{3})?[A-Za-z_][A-Za-z0-9_]*\]{1,2})$/;
/**
 * Lowercase words joined by two or more hyphens look like a verification code
 * (`abcd-efgh-jkmn-pqrs`), not like a route: they are parameters unless they are one of the few
 * static pages of the app with a name like that.
 */
const CODE_LIKE_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+){2,}$/;
const KNOWN_LONG_ROUTES: ReadonlySet<string> = new Set(['casos-de-exito', 'tratamiento-de-datos']);

/**
 * The dynamic routes of the app router (`src/app/**` directories named `[param]`), written as the
 * words that precede each parameter (`*`), counted from the root of the path. The segment at the
 * position of the last `*` is ALWAYS a parameter, whatever it looks like: a value made of lowercase
 * letters (a verification code typed in lowercase, a slug) is indistinguishable from a route word by
 * its shape, so the heuristic alone would let it through. `statics` are the sibling static pages that
 * live in the same position (`/patients/new`). `sentry-route.test.ts` fails when a `[param]`
 * directory is missing here.
 *
 * `anywhere` patterns are matched wherever they appear in the path, not from its root: the one API
 * route that answers without a session (`/public/documents/<code>`, called with a prefix such as
 * `/api/v1`). The rest of the API URLs are NOT covered by this list, only by the shape heuristic: an
 * id of the API in lowercase letters would pass. They do not reach Sentry today because the `http`,
 * `fetch` and `xhr` breadcrumbs are dropped and the API errors are not reported by the web.
 */
const DYNAMIC_ROUTES: ReadonlyArray<{
  pattern: readonly string[];
  statics?: readonly string[];
  anywhere?: boolean;
}> = [
  { pattern: ['verify', '*'] },
  { pattern: ['patients', '*'], statics: ['new'] },
  { pattern: ['patients', '*', 'records', '*'] },
  { pattern: ['cash', 'orders', '*'] },
  { pattern: ['treatment-sessions', '*'] },
  { pattern: ['platform', 'tenants', '*'], statics: ['new'] },
  { pattern: ['public', 'documents', '*'], anywhere: true },
];

/** `parts` is `path.split('/')` of an absolute path: `parts[0]` is the empty string before the first `/`. */
function isDynamicSlot(parts: readonly string[], index: number): boolean {
  if (parts[0] !== '') return false;
  return DYNAMIC_ROUTES.some(({ pattern, statics, anywhere }) => {
    if (statics?.includes(parts[index])) return false;
    // `start` is the position of the first word of the pattern in `parts`.
    const start = index - pattern.length + 1;
    if (start < 1 || (!anywhere && start !== 1)) return false;
    return pattern.every((word, i) => word === '*' || word === parts[start + i]);
  });
}

function isRouteWord(segment: string): boolean {
  if (!STATIC_SEGMENT.test(segment)) return false;
  return !CODE_LIKE_SEGMENT.test(segment) || KNOWN_LONG_ROUTES.has(segment);
}

/**
 * Keeps the words of a route and replaces anything else (a UUID, a verification code, a number, an
 * encoded value) with `:param`, so a raw path that no route pattern matched cannot leak an id. The
 * segment of every dynamic route of the app (`/verify/<code>`, `/patients/<id>`...) is replaced
 * even when it looks like a word. Query string and fragment are always removed.
 */
export function parametrizePath(path: string): string {
  const parts = path.split(/[?#]/)[0].split('/');
  const segments = parts.map((segment, index) => {
    if (segment === '' || PARAM_SEGMENT.test(segment)) return segment;
    if (isDynamicSlot(parts, index)) return ':param';
    return isRouteWord(segment) ? segment : ':param';
  });
  return segments.join('/') || '/';
}

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:\/\//i;

function pathOf(nameOrUrl: string): string {
  if (!ABSOLUTE_URL.test(nameOrUrl)) return nameOrUrl;
  try {
    return new URL(nameOrUrl).pathname;
  } catch {
    return UNMATCHED;
  }
}

export function parametrizedName(name: string | undefined): string {
  if (!name) return UNMATCHED;
  const path = pathOf(name);
  return path.startsWith('/') ? parametrizePath(path) : UNMATCHED;
}

/** `https://app.example.com/patients/abc?x=1#y` becomes `https://app.example.com/patients/:param`. */
export function parametrizedUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parametrizePath(parsed.pathname)}`;
  } catch {
    return undefined;
  }
}

/**
 * Any location an event or a breadcrumb carries: an absolute URL (origin kept, no credentials) or a
 * path as the History API reports it (`/patients/1?x=1#y`). Anything else is `UNMATCHED`: it never
 * returns the input.
 */
export function parametrizedLocation(location: string): string {
  if (ABSOLUTE_URL.test(location)) return parametrizedUrl(location) ?? UNMATCHED;
  return location.startsWith('/') ? parametrizePath(location) : UNMATCHED;
}

const METHOD_AND_PATH = /^([A-Z]+) (\/.*)$/;

/**
 * The transaction of an error event: the route (`/patients/[id]`), the raw location of the page
 * (`/patients/<uuid>`) or, on the server, the route with its method (`GET /patients/[id]`).
 */
export function parametrizedTransactionName(name: string): string {
  const withMethod = METHOD_AND_PATH.exec(name);
  if (withMethod) return `${withMethod[1]} ${parametrizePath(withMethod[2])}`;
  return parametrizedName(name);
}

/** Browser page and app URLs: `https://host/...`, and `app:///...` after the Next normalization. */
const PAGE_LOCATION = /^((?:https?|app):\/\/)([^/?#]*)([^?#]*)(?:[?#].*)?$/i;
const ASSET_FILE = /\.(?:m?js|cjs|css|map|json|wasm)$/i;

/**
 * `filename` and `abs_path` of a stack frame. An error thrown by an inline script (the
 * `self.__next_f.push` of the page) is attributed to the URL of the document, so the frame carries
 * the page URL with its code or id, query string and fragment (`app:///verify/<code>?x=1`). Page
 * URLs are parametrized like any other location. Everything that is a file of the build is returned
 * untouched, because source maps are looked up by that name: `/_next/` assets, any `*.js` and the
 * like, server paths and other schemes (`webpack-internal:`, `node:`).
 */
export function parametrizedFrameFile(file: string): string {
  const match = PAGE_LOCATION.exec(file);
  if (!match) return file;
  const [, scheme, authority, path] = match;
  if (path.split('/').includes('_next') || ASSET_FILE.test(path)) {
    return `${scheme}${authority.replace(/^.*@/, '')}${path}`;
  }
  return `${scheme}${authority.replace(/^.*@/, '')}${parametrizePath(path)}`;
}
