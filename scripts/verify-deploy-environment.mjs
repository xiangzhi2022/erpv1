const PRODUCTION_PROJECT_REF = 'jfcsbwdawvsxnmovwlgl';
const PRODUCTION_APP_ORIGIN = 'https://qingya-erp-163.netlify.app';
const GUARDED_CONTEXTS = new Set(['production', 'deploy-preview', 'branch-deploy']);

function projectRefFromUrl(value) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.port
      || url.pathname !== '/'
      || url.search
      || url.hash
    ) {
      return null;
    }

    return url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function httpsOrigin(value, requiredHostnameSuffix) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.port
      || url.pathname !== '/'
      || url.search
      || url.hash
      || (requiredHostnameSuffix && !url.hostname.endsWith(requiredHostnameSuffix))
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

const context = process.env.CONTEXT?.trim();
if (!context || !GUARDED_CONTEXTS.has(context)) process.exit(0);

const projectRef = projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
let valid;

if (context === 'production') {
  valid = projectRef === PRODUCTION_PROJECT_REF
    && httpsOrigin(process.env.APP_URL) === PRODUCTION_APP_ORIGIN;
} else {
  const deployOrigin = httpsOrigin(process.env.DEPLOY_PRIME_URL, '.netlify.app');
  const applicationOrigin = httpsOrigin(process.env.APP_URL || process.env.DEPLOY_PRIME_URL);
  valid = projectRef !== null
    && projectRef !== PRODUCTION_PROJECT_REF
    && deployOrigin !== null
    && applicationOrigin === deployOrigin;
}

if (!valid) {
  process.stderr.write('Netlify Supabase deploy environment validation failed.\n');
  process.exit(1);
}
